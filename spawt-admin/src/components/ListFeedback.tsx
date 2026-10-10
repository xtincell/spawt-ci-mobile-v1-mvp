interface ListQuery {
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: { message?: string } | null;
  refetch: () => unknown;
}

/** Une lecture refusée ou indisponible ne signifie jamais « zéro résultat ». */
export function ListFeedback({ query, empty }: { query: ListQuery; empty: boolean }) {
  if (query.isError) {
    return (
      <div role="alert" style={{ margin: "12px 0", color: "var(--danger)" }}>
        <p>Chargement impossible : {query.error?.message ?? "connexion indisponible"}.</p>
        <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>
          Réessayer
        </button>
      </div>
    );
  }
  if (query.isLoading || query.isFetching) return <p role="status">Chargement…</p>;
  return empty ? <p role="status">Aucun résultat pour ces filtres.</p> : null;
}

export function ListPagination({ currentPage, pageCount, onPageChange, disabled }: {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  disabled: boolean;
}) {
  if (pageCount <= 1 && currentPage <= 1) return null;
  return (
    <nav aria-label="Pagination" style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0" }}>
      <button type="button" disabled={disabled || currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
        Précédente
      </button>
      <span>Page {currentPage} sur {Math.max(1, pageCount)}</span>
      <button type="button" disabled={disabled || currentPage >= pageCount} onClick={() => onPageChange(currentPage + 1)}>
        Suivante
      </button>
    </nav>
  );
}
