"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { signOut, type User } from "firebase/auth";
import {
  Clock3,
  CheckCircle2,
  PauseCircle,
  Search,
  LogOut,
  RefreshCw,
  ClipboardList,
  X,
  ShieldCheck,
} from "lucide-react";
import { getFirebaseServices } from "@/lib/firebase/client";
import { PRIVACY_VERSION } from "@/lib/privacy/policy";
import {
  actionLabels,
  statusLabels,
  type AuditRow,
  type Overview,
  type StudentRow,
} from "./types";

class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("ar", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Baghdad",
      }).format(new Date(value))
    : "غير مسجّل";
}
type Detail = {
  student: StudentRow;
  emailVerified: boolean;
  disabled: boolean;
  administrativeReason: string;
  enrollments: string[];
};
export function AdminDashboard({ user }: { user: User }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditNext, setAuditNext] = useState<string | null>(null);
  const [tab, setTab] = useState<"students" | "audit">("students");
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [field, setField] = useState("displayName");
  const [sort, setSort] = useState("newest");
  const [busy, setBusy] = useState(false);
  const [initial, setInitial] = useState(true);
  const [message, setMessage] = useState("");
  const [denied, setDenied] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [action, setAction] = useState("approve");
  const [programId, setProgramId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const operation = useRef<{ fingerprint: string; id: string } | null>(null);
  const appliedQuery = useRef("status=pending&sort=newest");
  const generation = useRef(0);
  const call = useCallback(
    async <T,>(url: string, init?: RequestInit): Promise<T> => {
      const token = await user.getIdToken();
      const response = await fetch(url, {
        ...init,
        cache: "no-store",
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${token}`,
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
        },
      });
      const data = await response.json();
      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          setDenied(true);
          setOverview(null);
          setRows([]);
          setAudit([]);
          setDetail(null);
          dialog.current?.close();
        }
        throw new RequestError(
          response.status,
          data.error ?? "تعذّر إتمام الطلب.",
        );
      }
      return data as T;
    },
    [user],
  );
  const loadRows = useCallback(
    async (query: string, after?: string) => {
      const current = ++generation.current;
      const data = await call<{ students: StudentRow[]; next: string | null }>(
        `/api/admin/students?${query}${after ? `&after=${encodeURIComponent(after)}` : ""}`,
      );
      if (current !== generation.current) return;
      setRows((previous) =>
        after ? [...previous, ...data.students] : data.students,
      );
      setNext(data.next);
    },
    [call],
  );
  const loadAudit = useCallback(
    async (after?: string) => {
      const data = await call<{ entries: AuditRow[]; next: string | null }>(
        `/api/admin/audit${after ? `?after=${encodeURIComponent(after)}` : ""}`,
      );
      setAudit((previous) =>
        after ? [...previous, ...data.entries] : data.entries,
      );
      setAuditNext(data.next);
    },
    [call],
  );
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await call<Overview>("/api/admin/overview");
        if (!active) return;
        setOverview(result);
        await loadRows(appliedQuery.current);
      } catch (error) {
        if (active)
          setMessage(
            error instanceof Error ? error.message : "تعذّر تحميل الإدارة.",
          );
      } finally {
        if (active) setInitial(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [call, loadRows]);
  async function run(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await operation();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "تعذّر الاتصال. أعد المحاولة.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function search(event: FormEvent) {
    event.preventDefault();
    const query = new URLSearchParams({
      status,
      q: q.trim(),
      field,
      sort,
    }).toString();
    await run(async () => {
      appliedQuery.current = query;
      await loadRows(query);
    });
  }
  async function review(uid: string) {
    await run(async () => {
      const result = await call<Detail>(`/api/admin/students/${uid}`);
      setDetail(result);
      setAction(result.student.status === "approved" ? "suspend" : "approve");
      setReason("");
      setProgramId("");
      setConfirmed(false);
      operation.current = null;
      dialog.current?.showModal();
    });
  }
  async function decide(event: FormEvent) {
    event.preventDefault();
    if (!detail || !confirmed) return;
    const body = {
      action,
      reason,
      programId: programId || null,
      expectedVersion: detail.student.version,
    };
    const fingerprint = JSON.stringify({ uid: detail.student.uid, ...body });
    if (operation.current?.fingerprint !== fingerprint)
      operation.current = { fingerprint, id: crypto.randomUUID() };
    await run(async () => {
      await call(`/api/admin/students/${detail.student.uid}`, {
        method: "POST",
        body: JSON.stringify({ ...body, requestId: operation.current!.id }),
      });
      dialog.current?.close();
      setDetail(null);
      setMessage("تم حفظ القرار وتسجيله في سجل التدقيق.");
      try {
        setOverview(await call<Overview>("/api/admin/overview"));
        await loadRows(appliedQuery.current);
      } catch {
        setMessage(
          "حُفظ القرار. تعذّر تحديث القائمة؛ اضغط تحديث لعرض أحدث حالة.",
        );
      }
    });
  }
  const actions = detail
    ? detail.student.status === "pending"
      ? ["approve", "reject"]
      : detail.student.status === "approved"
        ? ["suspend", "enroll", "unenroll"]
        : detail.student.status === "suspended"
          ? ["approve", "unenroll"]
          : ["approve"]
    : [];
  const requiresProgram = ["enroll", "unenroll"].includes(action);
  const canApprove =
    detail?.emailVerified &&
    !detail.disabled &&
    detail.student.consentVersion === PRIVACY_VERSION;
  return (
    <div className="container admin-shell">
      <div className="admin-heading">
        <div>
          <span className="eyebrow">
            <ShieldCheck size={16} /> مساحة الإدارة
          </span>
          <h1>إدارة الطلبة</h1>
          <p>طلبات واضحة، وقرارات موثّقة، ووصول بإذن.</p>
        </div>
        <button
          className="button button-outline"
          onClick={() => void run(() => signOut(getFirebaseServices().auth))}
        >
          <LogOut size={17} /> تسجيل الخروج
        </button>
      </div>
      <p className="admin-session">
        <bdi>{user.email}</bdi>
        <span>التوقيت المعروض: بغداد</span>
      </p>
      <div role="status" className={message ? "notice admin-feedback" : ""}>
        {message}
      </div>
      {initial ? (
        <p role="status">جارٍ تحميل الطلبات…</p>
      ) : denied ? (
        <section className="empty-state">
          <ShieldCheck size={32} />
          <h2>الوصول الإداري غير متاح</h2>
          <p>
            يلزم حساب موثّق البريد وصلاحية إدارية فعّالة. بعد تحديث الصلاحيات،
            سجّل الدخول مجددًا.
          </p>
        </section>
      ) : !overview ? (
        <button
          className="button button-outline"
          onClick={() => location.reload()}
        >
          إعادة المحاولة
        </button>
      ) : (
        <>
          <div className="admin-stats">
            {[
              { key: "pending", title: "طلبات جديدة", Icon: Clock3 },
              { key: "approved", title: "طلاب مقبولون", Icon: CheckCircle2 },
              { key: "suspended", title: "وصول معلّق", Icon: PauseCircle },
            ].map(({ key, title, Icon }) => (
              <article key={key}>
                <Icon size={23} />
                <span>{title}</span>
                <strong>
                  {new Intl.NumberFormat("ar").format(
                    overview.counts[key] ?? 0,
                  )}
                </strong>
              </article>
            ))}
          </div>
          <div className="admin-tabs" role="group" aria-label="أقسام الإدارة">
            <button
              aria-pressed={tab === "students"}
              onClick={() => setTab("students")}
            >
              طلبات الطلبة
            </button>
            <button
              disabled={busy}
              aria-pressed={tab === "audit"}
              onClick={() => {
                setTab("audit");
                void run(() => loadAudit());
              }}
            >
              <ClipboardList size={17} /> سجل التدقيق
            </button>
          </div>
          {tab === "students" ? (
            <section className="admin-panel" aria-label="طلبات الطلبة">
              <div className="panel-heading">
                <h2>الطلبات والتسجيلات</h2>
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      setOverview(await call<Overview>("/api/admin/overview"));
                      await loadRows(appliedQuery.current);
                    })
                  }
                >
                  <RefreshCw size={16} /> تحديث
                </button>
              </div>
              <form className="admin-filters" onSubmit={search}>
                <div>
                  <label htmlFor="admin-search">البحث</label>
                  <div className="search-field">
                    <Search size={18} />
                    <input
                      id="admin-search"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="بداية الاسم أو البريد"
                      maxLength={100}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="search-field">البحث بحسب</label>
                  <select
                    id="search-field"
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                  >
                    <option value="displayName">الاسم</option>
                    <option value="email">البريد الإلكتروني</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="status-filter">حالة الطلب</label>
                  <select
                    id="status-filter"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">جميع الحالات</option>
                    {Object.entries(statusLabels).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="sort-filter">ترتيب التسجيل</label>
                  <select
                    id="sort-filter"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    disabled={Boolean(q.trim())}
                  >
                    <option value="newest">الأحدث أولًا</option>
                    <option value="oldest">الأقدم أولًا</option>
                  </select>
                </div>
                <button className="button button-primary" disabled={busy}>
                  تطبيق البحث
                </button>
              </form>
              <p className="quiet">
                البحث بمطابقة بداية النص؛ عند البحث يُرتّب حسب الاسم أو البريد.
                يُعرض ٢٥ طلبًا في الصفحة.
              </p>
              {!rows.length ? (
                <div className="empty-state">
                  <CheckCircle2 size={30} />
                  <h3>لا توجد طلبات مطابقة</h3>
                  <p>غيّر الحالة أو عبارة البحث لعرض نتائج أخرى.</p>
                </div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>الطالب</th>
                        <th>تاريخ التسجيل</th>
                        <th>الحالة</th>
                        <th>المراجعة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((student) => (
                        <tr key={student.uid}>
                          <td data-label="الطالب">
                            <strong>{student.displayName}</strong>
                            <bdi className="student-email">{student.email}</bdi>
                          </td>
                          <td data-label="التاريخ">
                            {date(student.createdAt)}
                          </td>
                          <td data-label="الحالة">
                            <span
                              className={`status-pill status-${student.status}`}
                            >
                              {statusLabels[student.status] ?? "غير معروفة"}
                            </span>
                          </td>
                          <td>
                            <button
                              className="button button-outline"
                              disabled={busy}
                              onClick={() => void review(student.uid)}
                              aria-label={`مراجعة طلب ${student.displayName}`}
                            >
                              مراجعة الطلب
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {next && (
                <button
                  className="button button-outline load-more"
                  disabled={busy}
                  onClick={() =>
                    void run(() => loadRows(appliedQuery.current, next))
                  }
                >
                  عرض المزيد من الطلبات
                </button>
              )}
            </section>
          ) : (
            <section className="admin-panel">
              <div className="panel-heading">
                <h2>سجل القرارات</h2>
                <span className="quiet">
                  الأحدث أولًا · لا يمكن تعديله من الواجهة
                </span>
              </div>
              {!audit.length ? (
                <div className="empty-state">
                  <h3>لا توجد قرارات مسجّلة بعد</h3>
                </div>
              ) : (
                <ol className="audit-list">
                  {audit.map((entry) => (
                    <li key={entry.id}>
                      <div>
                        <strong>
                          {actionLabels[entry.action] ?? entry.action}
                        </strong>
                        <time>{date(entry.at)}</time>
                      </div>
                      <p>
                        المسؤول: <bdi>{entry.actorEmail || entry.actorUid}</bdi>
                      </p>
                      <p className="quiet">
                        معرّف المسؤول: <bdi>{entry.actorUid}</bdi> · الطالب:{" "}
                        <bdi>{entry.studentUid}</bdi>
                      </p>
                      <p>
                        {statusLabels[entry.from]} ← {statusLabels[entry.to]}{" "}
                        {entry.programId && (
                          <>
                            · البرنامج: <bdi>{entry.programId}</bdi>
                          </>
                        )}
                      </p>
                      {entry.reason && (
                        <p className="audit-reason">
                          سبب إداري: {entry.reason}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {auditNext && (
                <button
                  className="button button-outline load-more"
                  disabled={busy}
                  onClick={() => void run(() => loadAudit(auditNext))}
                >
                  عرض المزيد من القرارات
                </button>
              )}
            </section>
          )}
        </>
      )}
      <dialog
        ref={dialog}
        className="review-dialog"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        aria-labelledby="review-title"
      >
        <div className="panel-heading">
          <h2 id="review-title">مراجعة طلب التسجيل</h2>
          <button
            className="icon-button"
            aria-label="إغلاق المراجعة"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </button>
        </div>
        {detail && (
          <form className="review-form" onSubmit={decide}>
            <div className="review-identity">
              <h3>{detail.student.displayName}</h3>
              <bdi>{detail.student.email}</bdi>
              <span className={`status-pill status-${detail.student.status}`}>
                {statusLabels[detail.student.status]}
              </span>
            </div>
            <dl className="review-facts">
              <div>
                <dt>تأكيد البريد</dt>
                <dd>{detail.emailVerified ? "موثّق" : "بانتظار التحقق"}</dd>
              </div>
              <div>
                <dt>موافقة الخصوصية</dt>
                <dd>
                  {detail.student.consentVersion === PRIVACY_VERSION
                    ? "الإصدار الحالي"
                    : "تحتاج تحديثًا"}
                </dd>
              </div>
              <div>
                <dt>تاريخ التسجيل</dt>
                <dd>{date(detail.student.createdAt)}</dd>
              </div>
            </dl>
            <p className="quiet">
              البرامج المتاحة للطالب:{" "}
              {detail.enrollments
                .map(
                  (id) =>
                    overview?.programs.find((p) => p.id === id)?.title ?? id,
                )
                .join("، ") || "لا يوجد"}
            </p>
            {detail.administrativeReason && (
              <div className="notice">
                آخر ملاحظة إدارية: {detail.administrativeReason}
              </div>
            )}
            <label htmlFor="decision">القرار</label>
            <select
              id="decision"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setProgramId("");
                setConfirmed(false);
              }}
            >
              {actions.map((value) => (
                <option key={value} value={value}>
                  {actionLabels[value]}
                </option>
              ))}
            </select>
            {["approve", "enroll", "unenroll"].includes(action) && (
              <>
                <label htmlFor="program">
                  البرنامج {action === "approve" ? "(اختياري)" : ""}
                </label>
                <select
                  id="program"
                  value={programId}
                  required={requiresProgram}
                  onChange={(e) => setProgramId(e.target.value)}
                >
                  <option value="">
                    {requiresProgram
                      ? "اختر البرنامج"
                      : "قبول التسجيل دون إتاحة برنامج الآن"}
                  </option>
                  {(action === "unenroll"
                    ? detail.enrollments.map((id) => ({
                        id,
                        title:
                          overview?.programs.find((p) => p.id === id)?.title ??
                          id,
                      }))
                    : (overview?.programs ?? [])
                  ).map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.title}
                    </option>
                  ))}
                </select>
              </>
            )}
            {!canApprove && ["approve", "enroll"].includes(action) && (
              <div className="notice">
                لا يمكن القبول أو إتاحة برنامج قبل تأكيد البريد والموافقة
                الحالية، وبقاء حساب الطالب فعّالًا.
              </div>
            )}
            <label htmlFor="admin-reason">سبب أو ملاحظة إدارية (اختياري)</label>
            <textarea
              id="admin-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              rows={3}
            />
            <p className="quiet">للمسؤولين فقط؛ لا تظهر هذه الملاحظة للطالب.</p>
            <label className="consent-check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                required
              />{" "}
              أؤكد مراجعة الطلب وحفظ هذا القرار في سجل التدقيق.
            </label>
            <p role="status">{message}</p>
            <button
              className="button button-primary"
              disabled={
                busy ||
                !confirmed ||
                (["approve", "enroll"].includes(action) && !canApprove)
              }
            >
              {busy ? "جارٍ الحفظ…" : "تأكيد القرار"}
            </button>
          </form>
        )}
      </dialog>
    </div>
  );
}
