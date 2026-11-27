// last_reviewed_at uses the database session clock. Explicit deadlines use UTC.
export const reviewDueSql = `COALESCE(d.review_due_override_utc,
  CONVERT_TZ(DATE_ADD(d.last_reviewed_at, INTERVAL 1 YEAR), @@session.time_zone, '+00:00'))`;

export const reviewStatusSql = `CASE
  WHEN d.status <> 'Aktif' THEN 'inactive'
  WHEN d.last_reviewed_at IS NULL THEN 'unreviewed'
  WHEN d.last_reviewed_version IS NULL OR d.last_reviewed_version <> d.active_version THEN 'version_changed'
  WHEN ${reviewDueSql} <= UTC_TIMESTAMP(3) THEN 'overdue'
  ELSE 'current' END`;

export const reviewColumns = `${reviewDueSql} review_due_at, ${reviewStatusSql} review_status,
  UTC_TIMESTAMP(3) review_clock, CONVERT_TZ(d.last_reviewed_at, @@session.time_zone, '+00:00') reviewed_utc`;

export function utcString(value) {
  return value ? value.replace(' ', 'T') + 'Z' : null;
}

export function reviewFields(row) {
  return {
    reviewDueAt: utcString(row.review_due_at),
    reviewClock: utcString(row.review_clock),
    lastReviewedAt: utcString(row.reviewed_utc),
    customSchedule: row.review_due_override_utc != null,
    reviewStatus: row.review_status,
    reviewDue: ['unreviewed', 'version_changed', 'overdue'].includes(row.review_status),
  };
}
