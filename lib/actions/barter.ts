'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requirePlayer } from '@/lib/session';
import { go } from '@/lib/flash';
import { scrapTotal, SCRAP_TYPES } from '@/lib/core';
import {
  MAX_PENDING_OUTGOING,
  bundleIsEmpty,
  covers,
  describeBundle,
  emptyBundle,
  parseBundle,
  roomShortfallText,
  serializeBundle,
  type Bundle,
} from '@/lib/barter';
import {
  evaluateTrade,
  loadItemsById,
  loadTradeBase,
  logTrade,
  partyFrom,
  transitionTrade,
} from '@/lib/barter-data';
import { changeHolding, changeScrap, loadInventory } from '@/lib/inventory';
import type { Character, Trade } from '@/lib/types';

const BARTER = '/play/barter';
const uuid = z.string().uuid();

function refresh() {
  for (const p of ['/play', BARTER, '/play/inventory', '/play/storage']) revalidatePath(p);
}

/** Susun bundle dari field form: `${prefix}item_<uuid>` = jumlah, `${prefix}scrap_<jenis>` = jumlah. */
function readBundle(fd: FormData, prefix: 'o_' | 'r_'): Bundle {
  const items: { item_id: string; qty: number }[] = [];
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith(`${prefix}item_`)) continue;
    const id = key.slice(`${prefix}item_`.length);
    if (uuid.safeParse(id).success) items.push({ item_id: id, qty: Number(value) });
  }
  const scrap: Record<string, number> = {};
  for (const t of SCRAP_TYPES) scrap[t] = Number(fd.get(`${prefix}scrap_${t}`) ?? 0);
  return parseBundle({ items, scrap });
}

// ======================= Buat tawaran =======================

export async function createTrade(formData: FormData) {
  const me = await requirePlayer();
  if (!me.setup_done) go('/play/setup', 'error', 'Fill in your character first.');

  const to = uuid.safeParse(formData.get('to'));
  const back = to.success ? `${BARTER}/new?to=${to.data}` : `${BARTER}/new`;
  const mode = formData.get('mode') === 'swap' ? 'swap' : 'give';
  if (!to.success || to.data === me.id) go(`${BARTER}/new`, 'error', 'Choose who to trade with.');

  const { data: rc } = await db()
    .from('character')
    .select('*')
    .eq('id', to.data)
    .eq('campaign_id', me.campaign_id)
    .maybeSingle();
  const receiver = rc as Character | null;
  if (!receiver || !receiver.setup_done) go(`${BARTER}/new`, 'error', 'That character is not available for trading.');

  const offer = readBundle(formData, 'o_');
  const request = mode === 'swap' ? readBundle(formData, 'r_') : emptyBundle();
  if (bundleIsEmpty(offer)) go(back, 'error', 'Pick something to offer.');
  if (mode === 'swap' && bundleIsEmpty(request)) go(back, 'error', `Pick what you want from ${receiver.name}.`);

  // Item harus ada di campaign ini.
  const items = await loadItemsById([...offer.items, ...request.items].map((l) => l.itemId));
  for (const l of [...offer.items, ...request.items]) {
    if (items.get(l.itemId)?.campaign_id !== me.campaign_id) go(back, 'error', 'One of the items no longer exists.');
  }

  // Barang yang ditawarkan/diminta harus ada di Inventory masing-masing saat ini.
  const [mine, theirs] = await Promise.all([loadInventory(me), loadInventory(receiver)]);
  if (!covers(partyFrom(mine), offer)) go(back, 'error', 'You do not have that much in your Inventory.');
  if (mode === 'swap' && !covers(partyFrom(theirs), request)) go(back, 'error', `${receiver.name} does not have that in their Inventory.`);

  const { count } = await db()
    .from('trade')
    .select('id', { count: 'exact', head: true })
    .eq('from_character', me.id)
    .eq('status', 'pending');
  if ((count ?? 0) >= MAX_PENDING_OUTGOING) go(BARTER, 'error', `You already have ${MAX_PENDING_OUTGOING} pending offers. Cancel one first.`);

  const { data: row, error } = await db()
    .from('trade')
    .insert({
      campaign_id: me.campaign_id,
      from_character: me.id,
      to_character: receiver.id,
      mode,
      offer: serializeBundle(offer),
      request: mode === 'swap' ? serializeBundle(request) : null,
    })
    .select('*')
    .single();
  if (error || !row) go(back, 'error', 'Could not send the offer. Try again.');

  const names = new Map([...items].map(([id, item]) => [id, item.name]));
  await logTrade(me, 'offered', { trade: row as Trade, sender: me, receiver, offer, request, names });
  refresh();
  go(BARTER, 'ok', `Offer sent to ${receiver.name}.`);
}

// ======================= Terima =======================

type Undo = () => Promise<unknown>;

/** Pindahkan satu bundle dari Inventory `fromId` ke Inventory `toId`; setiap langkah yang berhasil dicatat di `undo`. */
async function moveBundle(fromId: string, toId: string, b: Bundle, undo: Undo[]): Promise<boolean> {
  for (const l of b.items) {
    if (!(await changeHolding(fromId, l.itemId, 'inventory', -l.qty))) return false;
    undo.push(() => changeHolding(fromId, l.itemId, 'inventory', l.qty));
    if (!(await changeHolding(toId, l.itemId, 'inventory', l.qty))) return false;
    undo.push(() => changeHolding(toId, l.itemId, 'inventory', -l.qty));
  }
  if (scrapTotal(b.scrap) > 0) {
    const neg = { bio: -b.scrap.bio, arcane: -b.scrap.arcane, mech: -b.scrap.mech, ferrous: -b.scrap.ferrous };
    if (!(await changeScrap(fromId, 'inventory', neg))) return false;
    undo.push(() => changeScrap(fromId, 'inventory', b.scrap));
    if (!(await changeScrap(toId, 'inventory', b.scrap))) return false;
    undo.push(() => changeScrap(toId, 'inventory', neg));
  }
  return true;
}

async function loadTrade(id: string, campaignId: string): Promise<Trade | null> {
  const { data } = await db().from('trade').select('*').eq('id', id).eq('campaign_id', campaignId).maybeSingle();
  return data as Trade | null;
}

export async function acceptTrade(tradeId: string, _formData?: FormData) {
  const me = await requirePlayer();
  if (!uuid.safeParse(tradeId).success) go(BARTER, 'error', 'Invalid offer.');
  const trade = await loadTrade(tradeId, me.campaign_id);
  if (!trade || trade.to_character !== me.id) go(BARTER, 'error', 'Offer not found.');
  if (trade.status !== 'pending') go(BARTER, 'error', 'This offer was already handled.');

  const v = await evaluateTrade(trade);
  if (!v) {
    await transitionTrade(trade.id, 'pending', 'cancelled');
    refresh();
    go(BARTER, 'error', 'That character no longer exists. The offer was cancelled.');
  }

  if (!v.check.ok) {
    if (v.check.reason === 'changed') {
      if (await transitionTrade(trade.id, 'pending', 'cancelled')) {
        await logTrade(v.sender, 'auto_cancelled', v, 'Items changed before the offer was accepted.');
      }
      refresh();
      go(BARTER, 'error', 'The items changed, so the offer was cancelled.');
    }
    // Belum ada ruang: tawaran tetap pending sampai ruang dibuat.
    if (v.check.reason === 'no_room_receiver') {
      go(BARTER, 'error', `Not enough Inventory space (${roomShortfallText(v.check.overQ)}). Make room, then accept.`);
    }
    go(BARTER, 'error', `${v.sender.name} does not have room for the items you asked for yet (${roomShortfallText(v.check.overQ)}).`);
  }

  // Klaim dulu: hanya satu permintaan yang bisa lanjut (klik ganda aman).
  if (!(await transitionTrade(trade.id, 'pending', 'accepted'))) go(BARTER, 'error', 'This offer was already handled.');

  const undo: Undo[] = [];
  let ok = await moveBundle(v.sender.id, v.receiver.id, v.offer, undo);
  if (ok && trade.mode === 'swap') ok = await moveBundle(v.receiver.id, v.sender.id, v.request, undo);
  if (!ok) {
    for (const step of undo.reverse()) await step();
    await transitionTrade(trade.id, 'accepted', 'pending');
    refresh();
    go(BARTER, 'error', 'Could not complete the trade. Nothing was changed. Try again.');
  }

  await logTrade(me, 'accepted', v);
  refresh();
  const got = describeBundle(v.offer, v.names);
  go(BARTER, 'ok', trade.mode === 'swap' ? `Trade done: you got ${got} and gave ${describeBundle(v.request, v.names)}.` : `You received ${got} from ${v.sender.name}.`);
}

// ======================= Tolak / batalkan =======================

export async function declineTrade(tradeId: string, _formData?: FormData) {
  const me = await requirePlayer();
  if (!uuid.safeParse(tradeId).success) go(BARTER, 'error', 'Invalid offer.');
  const trade = await loadTrade(tradeId, me.campaign_id);
  if (!trade || trade.to_character !== me.id) go(BARTER, 'error', 'Offer not found.');
  if (!(await transitionTrade(trade.id, 'pending', 'declined'))) go(BARTER, 'error', 'This offer was already handled.');

  const base = await loadTradeBase(trade);
  if (base) await logTrade(me, 'declined', base);
  refresh();
  go(BARTER, 'ok', 'Offer declined.');
}

export async function cancelTrade(tradeId: string, _formData?: FormData) {
  const me = await requirePlayer();
  if (!uuid.safeParse(tradeId).success) go(BARTER, 'error', 'Invalid offer.');
  const trade = await loadTrade(tradeId, me.campaign_id);
  if (!trade || trade.from_character !== me.id) go(BARTER, 'error', 'Offer not found.');
  if (!(await transitionTrade(trade.id, 'pending', 'cancelled'))) go(BARTER, 'error', 'This offer was already handled.');

  const base = await loadTradeBase(trade);
  if (base) await logTrade(me, 'cancelled', base);
  refresh();
  go(BARTER, 'ok', 'Offer cancelled.');
}
