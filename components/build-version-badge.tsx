const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/i;
const COMMIT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function formatCommitDate(value: string) {
  const match = COMMIT_DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year.slice(-2)}`;
}

export function BuildVersionBadge() {
  const commit = process.env.NEXT_PUBLIC_BUILD_COMMIT?.trim();
  const date = process.env.NEXT_PUBLIC_BUILD_COMMIT_DATE?.trim();
  const formattedDate = date ? formatCommitDate(date) : null;

  if (!commit || !COMMIT_PATTERN.test(commit) || !formattedDate) {
    return null;
  }

  return (
    <aside className="build-version-badge" aria-label={`Version ${commit.slice(0, 7)} du ${formattedDate}`}>
      <code>{commit.slice(0, 7)}</code>
      <span aria-hidden="true">·</span>
      <time dateTime={date}>{formattedDate}</time>
    </aside>
  );
}
