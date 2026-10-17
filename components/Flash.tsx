export function Flash({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <div className="flash-wrap">
      {error ? (
        <p className="flash flash-error" role="alert">{error}</p>
      ) : (
        <p className="flash flash-ok" role="status">{ok}</p>
      )}
    </div>
  );
}
