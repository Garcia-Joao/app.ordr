"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  Edit,
  Loader2,
  Music,
  BarChart3,
  DollarSign,
  Ticket,
  UserCheck,
  Plus,
  Search,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  createEventDate,
  createEventTemplate,
  cancelEventDate,
  deleteEventDate,
  deleteEventTemplate,
  getEventDates,
  getEventPeople,
  getEventTemplates,
  updateEventDate,
  updateEventDatePersonStatus,
  updateEventTemplate,
  type EventDate,
  type EventDateStatus,
  type EventLinkedPerson,
  type EventPerson,
  type EventPersonStatus,
  type EventTemplate,
  type SaveEventPersonInput,
} from "@/lib/api/events";
import {
  getSalesEnvironments,
  type SalesEnvironment,
} from "@/lib/api/sales-environments";
import {
  createStaffEvaluationCriterion,
  getEventStaffForReview,
  getStaffEvaluationCriteria,
  saveStaffEvaluation,
  type EventStaffReviewItem,
  type StaffEvaluationCriterion,
} from "@/lib/api/staff-evaluations";

type Tab = "agenda" | "templates";
type ModalMode = "template" | "date" | null;

type EventDisplayStatus = EventDateStatus | "active";

const statusLabels: Record<EventDisplayStatus, string> = {
  active: "Ativo",
  scheduled: "Agendado",
  done: "Finalizado",
  cancelled: "Cancelado",
};

const personStatusLabels: Record<EventPersonStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  declined: "Recusou",
  maybe: "Talvez",
};

function toDateInputValue(value: Date) {
  const offset = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function toDateTimeLocalValue(value?: string | Date | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);

  return local.toISOString().slice(0, 16);
}

function nowDateTimeLocal() {
  return toDateTimeLocalValue(new Date());
}

function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    from: toDateInputValue(start),
    to: toDateInputValue(end),
  };
}

function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(value: string | Date) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatEventPeriod(eventDate: EventDate) {
  if (!eventDate.endAt) return formatDateTime(eventDate.startAt);

  return `${formatDateTime(eventDate.startAt)} - ${formatDateTime(eventDate.endAt)}`;
}

function formatBRL(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatHours(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0h";

  const rounded = Math.round(value * 100) / 100;
  return `${String(rounded).replace(".", ",")}h`;
}

function getEventDurationHours(eventDate: EventDate) {
  if (!eventDate.endAt) return 0;

  const start = new Date(eventDate.startAt).getTime();
  const end = new Date(eventDate.endAt).getTime();
  const diff = end - start;

  if (!Number.isFinite(diff) || diff <= 0) return 0;

  return diff / 3_600_000;
}

function getLinkedPersonWorkHours(
  eventDate: EventDate,
  linkedPerson: EventLinkedPerson,
) {
  if (linkedPerson.worksFullEvent === false) {
    return Number(linkedPerson.workHours ?? 0);
  }

  return getEventDurationHours(eventDate);
}

function estimateLinkedPersonCost(
  eventDate: EventDate,
  linkedPerson: EventLinkedPerson,
) {
  const override = Number(linkedPerson.costOverride ?? 0);

  if (Number.isFinite(override) && override > 0) {
    return override;
  }

  const rateAmount = Number(linkedPerson.person.rateAmount ?? 0);

  if (!Number.isFinite(rateAmount) || rateAmount <= 0) {
    return 0;
  }

  const rateType = linkedPerson.person.rateType ?? "EVENT";

  if (rateType === "HOURLY") {
    const hours = getLinkedPersonWorkHours(eventDate, linkedPerson);
    return hours > 0 ? rateAmount * hours : 0;
  }

  if (rateType === "DAILY" || rateType === "EVENT") {
    return rateAmount;
  }

  return 0;
}

function getEventStaffCost(eventDate: EventDate) {
  return eventDate.people
    .filter((person) => person.status !== "declined")
    .reduce(
      (sum, person) => sum + estimateLinkedPersonCost(eventDate, person),
      0,
    );
}

function isReceivedBuyRequestStatus(status?: string | null) {
  return status === "received" || status === "partially_received";
}

function isActuallyBoughtBuyItem(item: {
  boughtQuantity?: number | string | null;
  totalPrice?: number | string | null;
  unitPrice?: number | string | null;
  status?: string | null;
}) {
  if (String(item.status ?? "") === "not_bought") return false;

  const boughtQuantity = Number(item.boughtQuantity ?? 0);
  if (!Number.isFinite(boughtQuantity) || boughtQuantity <= 0) return false;

  const totalPrice = Number(item.totalPrice ?? 0);
  const unitPrice = Number(item.unitPrice ?? 0);

  return (
    (Number.isFinite(totalPrice) && totalPrice > 0) ||
    (Number.isFinite(unitPrice) && unitPrice > 0)
  );
}

function getEventBuyRequests(eventDate: EventDate) {
  return (
    ((eventDate as any).buyRequests ?? []) as Array<{
      id: string;
      title: string;
      supplierName?: string | null;
      status?: string | null;
      createdAt?: string | Date | null;
      items?: Array<{
        id?: string;
        product?: { name?: string | null; stockUnit?: string | null } | null;
        requestedQuantity?: number | string | null;
        boughtQuantity?: number | string | null;
        unitPrice?: number | string | null;
        totalPrice?: number | string | null;
        status?: string | null;
      }>;
    }>
  ).filter((request) => isReceivedBuyRequestStatus(request.status));
}

function getBuyItemUnitLabel(item: {
  product?: { stockUnit?: string | null } | null;
}) {
  const unit = item.product?.stockUnit;
  if (unit === "unit") return "un.";
  return unit ?? "un.";
}

function getBuyRequestItemCost(item: {
  boughtQuantity?: number | string | null;
  unitPrice?: number | string | null;
  totalPrice?: number | string | null;
  status?: string | null;
}) {
  if (!isActuallyBoughtBuyItem(item)) return 0;

  const totalPrice = Number(item.totalPrice ?? 0);
  if (Number.isFinite(totalPrice) && totalPrice > 0) return totalPrice;

  const boughtQuantity = Number(item.boughtQuantity ?? 0);
  const unitPrice = Number(item.unitPrice ?? 0);

  if (!Number.isFinite(boughtQuantity) || !Number.isFinite(unitPrice)) return 0;

  return boughtQuantity * unitPrice;
}

function getBuyRequestTotal(
  request: ReturnType<typeof getEventBuyRequests>[number],
) {
  return (request.items ?? [])
    .filter(isActuallyBoughtBuyItem)
    .reduce((sum, item) => sum + getBuyRequestItemCost(item), 0);
}

function getEventBuyCost(eventDate: EventDate) {
  return getEventBuyRequests(eventDate).reduce(
    (sum, request) => sum + getBuyRequestTotal(request),
    0,
  );
}

function getEventTotalCost(eventDate: EventDate) {
  return getEventStaffCost(eventDate) + getEventBuyCost(eventDate);
}

function getEventDisplayStatus(eventDate: EventDate): EventDisplayStatus {
  if (eventDate.status === "cancelled" || eventDate.status === "done") {
    return eventDate.status;
  }

  const now = new Date();
  const start = new Date(eventDate.startAt);
  const end = eventDate.endAt ? new Date(eventDate.endAt) : null;

  if (end && end < now) {
    return "done";
  }

  if (start <= now && (!end || end >= now)) {
    return "active";
  }

  return "scheduled";
}

function personMainFunction(person: EventPerson) {
  return person.functions?.[0]?.function?.name ?? "Pessoa";
}

function splitFunctionNames(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinFunctionNames(names: string[]) {
  return Array.from(
    new Set(names.map((name) => name.trim()).filter(Boolean)),
  ).join(", ");
}

function getLinkedPersonFunctionNames(linkedPerson: EventLinkedPerson) {
  const names = splitFunctionNames(linkedPerson.functionName);
  return names.length ? names : [personMainFunction(linkedPerson.person)];
}

function getPersonFunctionNames(person: EventPerson) {
  const names = (person.functions ?? [])
    .map((assignment) => assignment.function?.name)
    .filter((name): name is string => Boolean(name));

  return Array.from(new Set(names));
}

function getFunctionsTextFromEventPerson(person: EventPerson) {
  const names = getPersonFunctionNames(person);
  return names.length ? names.join(", ") : "Sem função";
}

function getAvailableFunctionNamesForPerson(
  person: EventPerson,
  eventDate: EventDate,
) {
  const used = new Set(
    eventDate.people
      .filter((item) => item.personId === person.id)
      .flatMap((item) => getLinkedPersonFunctionNames(item)),
  );

  const options = getPersonFunctionNames(person);
  const baseOptions = options.length ? options : ["Pessoa"];

  return baseOptions.filter((name) => !used.has(name));
}

function getPeopleSummary(people: EventLinkedPerson[]) {
  const confirmed = people.filter((item) => item.status === "confirmed").length;
  const pending = people.filter((item) => item.status === "pending").length;
  const total = people.length;

  return {
    confirmed,
    pending,
    total,
  };
}

function StatusBadge({ status }: { status: EventDisplayStatus }) {
  const className =
    status === "active"
      ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
      : status === "done"
        ? "bg-success/15 text-success border-success/30"
        : status === "cancelled"
          ? "bg-destructive/15 text-destructive border-destructive/30"
          : "bg-primary/15 text-primary border-primary/30";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function PersonStatusBadge({ status }: { status?: EventPersonStatus }) {
  const value = status ?? "pending";

  const className =
    value === "confirmed"
      ? "bg-success/15 text-success border-success/30"
      : value === "declined"
        ? "bg-destructive/15 text-destructive border-destructive/30"
        : value === "maybe"
          ? "bg-warning/15 text-warning border-warning/30"
          : "bg-secondary text-secondary-foreground border-border";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {personStatusLabels[value]}
    </span>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground" />
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function ModalSectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border-b border-border/70 pb-2 pt-1">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>

      {description && (
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

export default function EventosPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [tab, setTab] = useState<Tab>("agenda");
  const [people, setPeople] = useState<EventPerson[]>([]);
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [eventDates, setEventDates] = useState<EventDate[]>([]);
  const [salesEnvironments, setSalesEnvironments] = useState<
    SalesEnvironment[]
  >([]);

  const [selectedEventDate, setSelectedEventDate] = useState<EventDate | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    EventDateStatus | "active" | "all"
  >("all");

  const [range, setRange] = useState(monthBounds());
  const [modalMode, setModalMode] = useState<ModalMode>(null);

  const [editingTemplate, setEditingTemplate] = useState<EventTemplate | null>(
    null,
  );
  const [editingDate, setEditingDate] = useState<EventDate | null>(null);
  const [staffModalEvent, setStaffModalEvent] = useState<EventDate | null>(
    null,
  );
  const [costModalEvent, setCostModalEvent] = useState<EventDate | null>(null);
  const [staffReviewEvent, setStaffReviewEvent] = useState<EventDate | null>(
    null,
  );
  const [reviewStaff, setReviewStaff] = useState<EventStaffReviewItem[]>([]);
  const [reviewCriteria, setReviewCriteria] = useState<
    StaffEvaluationCriterion[]
  >([]);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [newCriterionName, setNewCriterionName] = useState("");

  const [templateForm, setTemplateForm] = useState({
    title: "",
    description: "",
    notes: "",
    defaultExpectedAudience: "",
    defaultStartTime: "",
    defaultEndTime: "",
    salesEnvironmentId: "",
    fixedPeople: [] as SaveEventPersonInput[],
  });

  const [dateForm, setDateForm] = useState({
    eventTemplateId: "",
    title: "",
    description: "",
    notes: "",
    startAt: nowDateTimeLocal(),
    endAt: "",
    expectedAudience: "",
    salesEnvironmentId: "",
    status: "scheduled" as EventDateStatus,
    people: [] as SaveEventPersonInput[],
  });

  async function loadData() {
    const [peopleData, templatesData, eventDatesData, salesEnvironmentData] =
      await Promise.all([
        getEventPeople(),
        getEventTemplates(),
        getEventDates({
          from: range.from,
          to: range.to,
          status: statusFilter,
        }),
        getSalesEnvironments(),
      ]);

    setPeople(peopleData);
    setTemplates(templatesData);
    setEventDates(eventDatesData);
    setSalesEnvironments(salesEnvironmentData);

    setSelectedEventDate((current) => {
      if (!current) return eventDatesData[0] ?? null;
      return (
        eventDatesData.find((eventDate) => eventDate.id === current.id) ?? null
      );
    });
  }

  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        await loadData();
      } catch (error) {
        console.error("Erro ao carregar eventos:", error);
      } finally {
        setIsLoading(false);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, statusFilter]);

  const filteredEventDates = useMemo(() => {
    const term = search.trim().toLowerCase();

    return eventDates.filter((eventDate) => {
      if (!term) return true;

      return (
        eventDate.title.toLowerCase().includes(term) ||
        (eventDate.description ?? "").toLowerCase().includes(term) ||
        (eventDate.notes ?? "").toLowerCase().includes(term) ||
        eventDate.people.some((item) =>
          item.person.name.toLowerCase().includes(term),
        )
      );
    });
  }, [eventDates, search]);

  const defaultSalesEnvironment = useMemo(() => {
    return (
      salesEnvironments.find((environment) => environment.isDefault) ??
      salesEnvironments.find(
        (environment) => environment.name.toLowerCase() === "padrão",
      ) ??
      salesEnvironments[0] ??
      null
    );
  }, [salesEnvironments]);

  const selectableSalesEnvironments = useMemo(() => {
    return salesEnvironments.filter(
      (environment) => environment.id !== defaultSalesEnvironment?.id,
    );
  }, [salesEnvironments, defaultSalesEnvironment]);

  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();

    return templates.filter((template) => {
      if (!term) return true;

      return (
        template.title.toLowerCase().includes(term) ||
        (template.description ?? "").toLowerCase().includes(term) ||
        (template.notes ?? "").toLowerCase().includes(term) ||
        template.fixedPeople.some((item) =>
          item.person.name.toLowerCase().includes(term),
        )
      );
    });
  }, [templates, search]);

  function resetTemplateForm() {
    setEditingTemplate(null);
    setTemplateForm({
      title: "",
      description: "",
      notes: "",
      defaultExpectedAudience: "",
      defaultStartTime: "",
      defaultEndTime: "",
      salesEnvironmentId: defaultSalesEnvironment?.id ?? "",
      fixedPeople: [],
    });
  }

  function resetDateForm() {
    setEditingDate(null);
    setDateForm({
      eventTemplateId: "",
      title: "",
      description: "",
      notes: "",
      startAt: nowDateTimeLocal(),
      endAt: "",
      expectedAudience: "",
      salesEnvironmentId: defaultSalesEnvironment?.id ?? "",
      status: "scheduled",
      people: [],
    });
  }

  function openNewTemplate() {
    resetTemplateForm();
    setModalMode("template");
  }

  function openEditTemplate(template: EventTemplate) {
    setEditingTemplate(template);
    setTemplateForm({
      title: template.title,
      description: template.description ?? "",
      notes: template.notes ?? "",
      defaultExpectedAudience:
        template.defaultExpectedAudience == null
          ? ""
          : String(template.defaultExpectedAudience),
      defaultStartTime: template.defaultStartTime ?? "",
      defaultEndTime: template.defaultEndTime ?? "",
      salesEnvironmentId:
        template.salesEnvironmentId ?? defaultSalesEnvironment?.id ?? "",
      fixedPeople: template.fixedPeople.map((item) => ({
        personId: item.personId,
        functionName: item.functionName ?? "",
        notes: item.notes ?? "",
        worksFullEvent: item.worksFullEvent ?? true,
        workHours: item.workHours ?? null,
        costOverride: item.costOverride ?? null,
        costNotes: item.costNotes ?? null,
      })),
    });
    setModalMode("template");
  }

  function openNewDate(template?: EventTemplate) {
    resetDateForm();

    if (template) {
      setDateForm((prev) => ({
        ...prev,
        eventTemplateId: template.id,
        title: template.title,
        description: template.description ?? "",
        notes: template.notes ?? "",
        expectedAudience:
          template.defaultExpectedAudience == null
            ? ""
            : String(template.defaultExpectedAudience),
        salesEnvironmentId:
          template.salesEnvironmentId ?? defaultSalesEnvironment?.id ?? "",
        people: template.fixedPeople.map((item) => ({
          personId: item.personId,
          functionName: item.functionName ?? "",
          status: "pending",
          notes: item.notes ?? "",
        })),
      }));
    }

    setModalMode("date");
  }

  function openEditDate(eventDate: EventDate) {
    setEditingDate(eventDate);

    setDateForm({
      eventTemplateId: eventDate.eventTemplateId ?? "",
      title: eventDate.title,
      description: eventDate.description ?? "",
      notes: eventDate.notes ?? "",
      startAt: toDateTimeLocalValue(eventDate.startAt),
      endAt: toDateTimeLocalValue(eventDate.endAt),
      expectedAudience:
        eventDate.expectedAudience == null
          ? ""
          : String(eventDate.expectedAudience),
      salesEnvironmentId:
        eventDate.salesEnvironmentId ?? defaultSalesEnvironment?.id ?? "",
      status: eventDate.status,
      people: eventDate.people.map((item) => ({
        personId: item.personId,
        functionName: item.functionName ?? "",
        status: item.status ?? "pending",
        notes: item.notes ?? "",
        worksFullEvent: item.worksFullEvent ?? true,
        workHours: item.workHours ?? null,
        costOverride: item.costOverride ?? null,
        costNotes: item.costNotes ?? null,
      })),
    });

    setModalMode("date");
  }

  function addPersonToTemplate(personId: string) {
    if (!personId) return;

    setTemplateForm((prev) => {
      if (prev.fixedPeople.some((item) => item.personId === personId)) {
        return prev;
      }

      const person = people.find((item) => item.id === personId);

      return {
        ...prev,
        fixedPeople: [
          ...prev.fixedPeople,
          {
            personId,
            functionName: person ? personMainFunction(person) : "",
            notes: "",
          },
        ],
      };
    });
  }

  function addPersonToDate(personId: string) {
    if (!personId) return;

    setDateForm((prev) => {
      if (prev.people.some((item) => item.personId === personId)) {
        return prev;
      }

      const person = people.find((item) => item.id === personId);

      return {
        ...prev,
        people: [
          ...prev.people,
          {
            personId,
            functionName: person ? personMainFunction(person) : "",
            status: "pending",
            notes: "",
          },
        ],
      };
    });
  }

  async function saveTemplate() {
    if (!templateForm.title.trim() || isSaving) return;

    try {
      setIsSaving(true);

      const payload = {
        title: templateForm.title,
        description: templateForm.description || null,
        notes: templateForm.notes || null,
        defaultExpectedAudience: templateForm.defaultExpectedAudience
          ? Number(templateForm.defaultExpectedAudience)
          : null,
        defaultStartTime: templateForm.defaultStartTime || null,
        defaultEndTime: templateForm.defaultEndTime || null,
        salesEnvironmentId: templateForm.salesEnvironmentId || null,
        fixedPeople: templateForm.fixedPeople,
      };

      if (editingTemplate) {
        await updateEventTemplate(editingTemplate.id, payload);
      } else {
        await createEventTemplate(payload);
      }

      setModalMode(null);
      resetTemplateForm();
      await loadData();
    } catch (error) {
      console.error("Erro ao salvar modelo de evento:", error);
      alert("Erro ao salvar modelo de evento");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveEventDate() {
    if (!dateForm.startAt || isSaving) return;

    try {
      setIsSaving(true);

      const selectedTemplate = templates.find(
        (template) => template.id === dateForm.eventTemplateId,
      );

      const payload = {
        eventTemplateId: dateForm.eventTemplateId || null,
        title: dateForm.title || selectedTemplate?.title || "Evento sem título",
        description: dateForm.description || null,
        notes: dateForm.notes || null,
        startAt: dateForm.startAt,
        endAt: dateForm.endAt || null,
        expectedAudience: dateForm.expectedAudience
          ? Number(dateForm.expectedAudience)
          : null,
        salesEnvironmentId: dateForm.salesEnvironmentId || null,
        status: dateForm.status,
        people: dateForm.people,
      };

      const saved = editingDate
        ? await updateEventDate(editingDate.id, payload)
        : await createEventDate(payload);

      setSelectedEventDate(saved);
      setModalMode(null);
      resetDateForm();
      await loadData();
    } catch (error) {
      console.error("Erro ao salvar data de evento:", error);
      alert("Erro ao salvar data de evento");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTemplate(template: EventTemplate) {
    if (!confirm(`Desativar o evento "${template.title}"?`)) return;

    try {
      await deleteEventTemplate(template.id);
      await loadData();
    } catch (error) {
      console.error("Erro ao desativar evento:", error);
      alert("Erro ao desativar evento");
    }
  }

  async function handleCancelEventDate(eventDate: EventDate) {
    if (!confirm(`Cancelar a data "${eventDate.title}"?`)) return;

    try {
      const updated = await cancelEventDate(eventDate.id);
      setSelectedEventDate(updated);
      await loadData();
    } catch (error: any) {
      console.error("Erro ao cancelar data:", error);
      alert(error?.message || "Erro ao cancelar data");
    }
  }

  async function handleDeleteEventDate(eventDate: EventDate) {
    if (eventDate.status !== "cancelled") {
      alert("A data precisa estar cancelada antes de ser excluída.");
      return;
    }

    if (
      !confirm(
        `Excluir definitivamente a data "${eventDate.title}"? Os pedidos vinculados ficarão sem evento.`,
      )
    )
      return;

    try {
      await deleteEventDate(eventDate.id);
      setSelectedEventDate(null);
      await loadData();
    } catch (error: any) {
      console.error("Erro ao excluir data:", error);
      alert(error?.message || "Erro ao excluir data");
    }
  }

  async function handlePersonStatusChange(
    eventDate: EventDate,
    linkedPerson: EventLinkedPerson,
    status: EventPersonStatus,
  ) {
    try {
      await updateEventDatePersonStatus(eventDate.id, linkedPerson.personId, {
        functionName: linkedPerson.functionName ?? null,
        status,
      });

      const updatedPeople = eventDate.people.map((person) =>
        person.id === linkedPerson.id ? { ...person, status } : person,
      );

      const updatedEvent = {
        ...eventDate,
        people: updatedPeople,
      };

      setSelectedEventDate((current) =>
        current?.id === eventDate.id ? updatedEvent : current,
      );
      setStaffModalEvent((current) =>
        current?.id === eventDate.id ? updatedEvent : current,
      );
      setCostModalEvent((current) =>
        current?.id === eventDate.id ? updatedEvent : current,
      );
      setEventDates((prev) =>
        prev.map((item) => (item.id === eventDate.id ? updatedEvent : item)),
      );
    } catch (error) {
      console.error("Erro ao atualizar presença:", error);
      alert("Erro ao atualizar presença");
    }
  }

  async function handlePersonWorkChange(
    eventDate: EventDate,
    linkedPerson: EventLinkedPerson,
    patch: {
      worksFullEvent?: boolean;
      workHours?: number | string | null;
      costOverride?: number | string | null;
      costNotes?: string | null;
    },
  ) {
    try {
      await updateEventDatePersonStatus(eventDate.id, linkedPerson.personId, {
        functionName: linkedPerson.functionName ?? null,
        status: linkedPerson.status ?? "pending",
        ...patch,
      });

      const updatedPeople = eventDate.people.map((person) =>
        person.id === linkedPerson.id ? { ...person, ...patch } : person,
      );

      const updatedEvent = {
        ...eventDate,
        people: updatedPeople,
      };

      setSelectedEventDate((current) =>
        current?.id === eventDate.id ? updatedEvent : current,
      );
      setStaffModalEvent((current) =>
        current?.id === eventDate.id ? updatedEvent : current,
      );
      setCostModalEvent((current) =>
        current?.id === eventDate.id ? updatedEvent : current,
      );
      setEventDates((prev) =>
        prev.map((item) => (item.id === eventDate.id ? updatedEvent : item)),
      );
    } catch (error) {
      console.error("Erro ao atualizar custo/horas da equipe:", error);
      alert("Erro ao atualizar custo/horas da equipe");
    }
  }

  async function handleRemovePersonFromEventDate(
    eventDate: EventDate,
    linkedPerson: EventLinkedPerson,
  ) {
    if (!confirm(`Remover ${linkedPerson.person.name} da equipe deste evento?`))
      return;

    try {
      const nextPeople = eventDate.people.filter(
        (person) => person.id !== linkedPerson.id,
      );

      const updatedEvent = await updateEventDate(eventDate.id, {
        people: nextPeople.map((person) => ({
          personId: person.personId,
          functionName: person.functionName ?? null,
          status: person.status ?? "pending",
          notes: person.notes ?? null,
          worksFullEvent: person.worksFullEvent ?? true,
          workHours: person.workHours ?? null,
          costOverride: person.costOverride ?? null,
          costNotes: person.costNotes ?? null,
        })),
      });

      setSelectedEventDate((current) =>
        current?.id === eventDate.id ? updatedEvent : current,
      );
      setStaffModalEvent((current) =>
        current?.id === eventDate.id ? updatedEvent : current,
      );
      setCostModalEvent((current) =>
        current?.id === eventDate.id ? updatedEvent : current,
      );
      setEventDates((prev) =>
        prev.map((item) => (item.id === eventDate.id ? updatedEvent : item)),
      );
    } catch (error) {
      console.error("Erro ao remover pessoa da equipe:", error);
      alert("Erro ao remover pessoa da equipe");
    }
  }

  async function openStaffReviewModal(eventDate: EventDate) {
    try {
      setIsLoadingReview(true);
      setStaffReviewEvent(eventDate);

      const [staff, criteria] = await Promise.all([
        getEventStaffForReview(eventDate.id),
        getStaffEvaluationCriteria(),
      ]);

      setReviewStaff(staff);
      setReviewCriteria(criteria);
    } catch (error: any) {
      console.error("Erro ao carregar revisão da equipe:", error);
      alert(error?.message || "Erro ao carregar revisão da equipe");
      setStaffReviewEvent(null);
    } finally {
      setIsLoadingReview(false);
    }
  }

  async function handleCreateReviewCriterion() {
    const name = newCriterionName.trim();
    if (!name) return;

    try {
      const created = await createStaffEvaluationCriterion({ name });
      setReviewCriteria((current) => {
        const exists = current.some((item) => item.id === created.id);
        const next = exists
          ? current.map((item) => (item.id === created.id ? created : item))
          : [...current, created];

        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setNewCriterionName("");
    } catch (error: any) {
      console.error("Erro ao criar parâmetro:", error);
      alert(error?.message || "Erro ao criar parâmetro");
    }
  }

  async function reloadStaffReview() {
    if (!staffReviewEvent) return;

    const staff = await getEventStaffForReview(staffReviewEvent.id);
    setReviewStaff(staff);
  }

  async function handleAddPersonToEventDate(
    eventDate: EventDate,
    personId: string,
    selectedFunctionNames?: string[] | string | null,
  ) {
    if (!personId) return;

    const person = people.find((item) => item.id === personId);
    if (!person) return;

    const rawNames = Array.isArray(selectedFunctionNames)
      ? selectedFunctionNames
      : selectedFunctionNames
        ? [selectedFunctionNames]
        : [];

    const fallback = personMainFunction(person);
    const functionNames = Array.from(
      new Set(
        (rawNames.length ? rawNames : [fallback])
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );

    const existingKeys = new Set(
      eventDate.people.map(
        (item) =>
          `${item.personId}:${item.functionName || personMainFunction(item.person)}`,
      ),
    );

    const newPeople = functionNames
      .filter(
        (functionName) => !existingKeys.has(`${personId}:${functionName}`),
      )
      .map((functionName) => ({
        personId,
        functionName,
        status: "pending" as EventPersonStatus,
        notes: null,
        worksFullEvent: true,
        workHours: null,
        costOverride: null,
        costNotes: null,
      }));

    if (newPeople.length === 0) return;

    try {
      const updatedEvent = await updateEventDate(eventDate.id, {
        people: [
          ...eventDate.people.map((item) => ({
            personId: item.personId,
            functionName: item.functionName ?? null,
            status: item.status ?? "pending",
            notes: item.notes ?? null,
            worksFullEvent: item.worksFullEvent ?? true,
            workHours: item.workHours ?? null,
            costOverride: item.costOverride ?? null,
            costNotes: item.costNotes ?? null,
          })),
          ...newPeople,
        ],
      });

      setSelectedEventDate((current) =>
        current?.id === eventDate.id ? updatedEvent : current,
      );
      setStaffModalEvent((current) =>
        current?.id === eventDate.id ? updatedEvent : current,
      );
      setCostModalEvent((current) =>
        current?.id === eventDate.id ? updatedEvent : current,
      );
      setEventDates((prev) =>
        prev.map((item) => (item.id === eventDate.id ? updatedEvent : item)),
      );
    } catch (error) {
      console.error("Erro ao adicionar pessoa na equipe:", error);
      alert("Erro ao adicionar pessoa na equipe");
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-muted-foreground">Carregando eventos...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Eventos</h1>
            <p className="text-sm text-muted-foreground">
              Agenda, equipe fixa, músicos e datas de eventos.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => openNewTemplate()}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-secondary"
            >
              <Plus className="h-4 w-4" />
              Novo evento
            </button>

            <button
              onClick={() => openNewDate()}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <CalendarDays className="h-4 w-4" />
              Agendar data
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-border bg-background p-1">
            <button
              onClick={() => setTab("agenda")}
              className={`h-9 rounded-md px-4 text-sm font-medium ${
                tab === "agenda"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Agenda
            </button>

            <button
              onClick={() => setTab("templates")}
              className={`h-9 rounded-md px-4 text-sm font-medium ${
                tab === "templates"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Eventos
            </button>
          </div>

          <div className="relative min-w-[280px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar evento ou pessoa..."
              className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {tab === "agenda" && (
            <>
              <input
                type="date"
                value={range.from}
                onChange={(event) =>
                  setRange((prev) => ({ ...prev, from: event.target.value }))
                }
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              />

              <input
                type="date"
                value={range.to}
                onChange={(event) =>
                  setRange((prev) => ({ ...prev, to: event.target.value }))
                }
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as any)}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="all">Todos</option>
                <option value="active">Ativos agora</option>
                <option value="scheduled">Agendados</option>
                <option value="done">Finalizados</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </>
          )}
        </div>
      </div>

      {tab === "agenda" ? (
        <div className="grid flex-1 grid-cols-[1fr_420px] overflow-hidden">
          <main className="overflow-y-auto p-6">
            {filteredEventDates.length === 0 ? (
              <EmptyState
                title="Nenhuma data encontrada"
                description="Crie uma data de evento para começar a montar sua agenda."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredEventDates.map((eventDate) => {
                  const peopleSummary = getPeopleSummary(eventDate.people);
                  const isSelected = selectedEventDate?.id === eventDate.id;

                  return (
                    <button
                      key={eventDate.id}
                      onClick={() => setSelectedEventDate(eventDate)}
                      className={`rounded-2xl border bg-card p-4 text-left transition hover:bg-secondary/40 ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border"
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-foreground">
                            {eventDate.title}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatDateOnly(eventDate.startAt)}
                          </p>
                        </div>

                        <StatusBadge
                          status={getEventDisplayStatus(eventDate)}
                        />
                      </div>

                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {formatEventPeriod(eventDate)}
                        </p>

                        <p className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {peopleSummary.confirmed}/{peopleSummary.total}{" "}
                          confirmados
                          {peopleSummary.pending > 0
                            ? ` • ${peopleSummary.pending} pendentes`
                            : ""}
                        </p>

                        <p>
                          Público esperado:{" "}
                          <span className="font-medium text-foreground">
                            {eventDate.expectedAudience ?? "-"}
                          </span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </main>

          <aside className="overflow-y-auto border-l border-border bg-card p-5">
            {!selectedEventDate ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                Selecione um evento da agenda para ver os detalhes.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {selectedEventDate.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {formatEventPeriod(selectedEventDate)}
                    </p>
                  </div>

                  <StatusBadge
                    status={getEventDisplayStatus(selectedEventDate)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Início</p>
                    <p className="mt-1 font-medium text-foreground">
                      {formatDateTime(selectedEventDate.startAt)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Fim</p>
                    <p className="mt-1 font-medium text-foreground">
                      {selectedEventDate.endAt
                        ? formatDateTime(selectedEventDate.endAt)
                        : "-"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="text-xs text-muted-foreground">
                      Público esperado
                    </p>
                    <p className="mt-1 font-medium text-foreground">
                      {selectedEventDate.expectedAudience ?? "-"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCostModalEvent(selectedEventDate)}
                    className="rounded-xl border border-border bg-background p-3 text-left transition hover:border-primary/40 hover:bg-secondary/40"
                  >
                    <p className="text-xs text-muted-foreground">Custos</p>
                    <p className="mt-1 font-medium text-foreground">
                      {formatBRL(getEventTotalCost(selectedEventDate))}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Equipe {formatBRL(getEventStaffCost(selectedEventDate))} •
                      Compras {formatBRL(getEventBuyCost(selectedEventDate))}
                    </p>
                  </button>
                </div>

                {selectedEventDate.notes && (
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Observações</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-foreground">
                      {selectedEventDate.notes}
                    </p>
                  </div>
                )}

                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-foreground">Equipe</h3>
                      <p className="text-xs text-muted-foreground">
                        {getPeopleSummary(selectedEventDate.people).confirmed}/
                        {selectedEventDate.people.length} confirmados
                      </p>
                    </div>

                    <button
                      onClick={() => setStaffModalEvent(selectedEventDate)}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <Users className="h-4 w-4" />
                      Gerenciar equipe
                    </button>
                  </div>

                  {selectedEventDate.people.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma pessoa vinculada.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedEventDate.people.slice(0, 6).map((item) => (
                        <span
                          key={item.id}
                          title={`${item.person.name} • ${
                            item.functionName || personMainFunction(item.person)
                          }`}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1 text-xs text-muted-foreground"
                        >
                          <span className="max-w-[120px] truncate">
                            {item.person.name}
                          </span>
                          <PersonStatusBadge status={item.status} />
                        </span>
                      ))}

                      {selectedEventDate.people.length > 6 && (
                        <span className="rounded-full border border-border bg-card px-2 py-1 text-xs text-muted-foreground">
                          +{selectedEventDate.people.length - 6}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {getEventDisplayStatus(selectedEventDate) === "done" && (
                  <button
                    onClick={() => openStaffReviewModal(selectedEventDate)}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Star className="h-4 w-4" />
                    Revisar equipe
                  </button>
                )}

                <div className="flex gap-2 border-t border-border pt-4">
                  <button
                    onClick={() => openEditDate(selectedEventDate)}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-secondary"
                  >
                    <Edit className="h-4 w-4" />
                    Editar
                  </button>

                  {selectedEventDate.status !== "cancelled" ? (
                    <button
                      onClick={() => handleCancelEventDate(selectedEventDate)}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-destructive/15 text-sm font-medium text-destructive hover:bg-destructive/25"
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDeleteEventDate(selectedEventDate)}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-destructive text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </button>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <main className="flex-1 overflow-y-auto p-6">
          {filteredTemplates.length === 0 ? (
            <EmptyState
              title="Nenhum evento criado"
              description="Crie modelos de eventos recorrentes, como noites de música, festas fechadas ou eventos temáticos."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredTemplates.map((template) => {
                const templateStats = (template as any).stats;
                const templateDates = ((template as any).eventDates ??
                  []) as EventDate[];
                const finishedDates = templateDates.filter(
                  (date) => getEventDisplayStatus(date) === "done",
                );

                return (
                  <div
                    key={template.id}
                    className="rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-foreground">
                          {template.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {template.description || "Sem descrição"}
                        </p>
                      </div>

                      <Music className="h-5 w-5 text-primary" />
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>
                        Público esperado padrão:{" "}
                        <span className="font-medium text-foreground">
                          {template.defaultExpectedAudience ?? "-"}
                        </span>
                      </p>

                      <p>
                        Horário padrão:{" "}
                        <span className="font-medium text-foreground">
                          {template.defaultStartTime || "--:--"} -{" "}
                          {template.defaultEndTime || "--:--"}
                        </span>
                      </p>

                      <p>
                        Equipe fixa:{" "}
                        <span className="font-medium text-foreground">
                          {template.fixedPeople.length}
                        </span>
                      </p>
                    </div>

                    {template.fixedPeople.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {template.fixedPeople.slice(0, 4).map((item) => (
                          <span
                            key={item.id}
                            title={`${item.person.name} • ${
                              item.functionName ||
                              personMainFunction(item.person)
                            }`}
                            className="max-w-full truncate rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
                          >
                            {item.person.name}
                          </span>
                        ))}

                        {template.fixedPeople.length > 4 && (
                          <span className="rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                            +{template.fixedPeople.length - 4}
                          </span>
                        )}
                      </div>
                    )}

                    {templateStats && (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-border bg-background p-3">
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <DollarSign className="h-3 w-3" />
                            Receita
                          </p>
                          <p className="mt-1 font-semibold text-foreground">
                            {formatBRL(templateStats.grossRevenue)}
                          </p>
                        </div>

                        <div className="rounded-xl border border-border bg-background p-3">
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Ticket className="h-3 w-3" />
                            Ticket médio
                          </p>
                          <p className="mt-1 font-semibold text-foreground">
                            {formatBRL(templateStats.averageTicket)}
                          </p>
                        </div>

                        <div className="rounded-xl border border-border bg-background p-3">
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <UserCheck className="h-3 w-3" />
                            Pessoas foram
                          </p>
                          <p className="mt-1 font-semibold text-foreground">
                            {templateStats.confirmedPeople ?? 0}
                          </p>
                        </div>

                        <div className="rounded-xl border border-border bg-background p-3">
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <BarChart3 className="h-3 w-3" />
                            Rendimento estimado
                          </p>
                          <p className="mt-1 font-semibold text-foreground">
                            {formatBRL(
                              templateStats.estimatedYield ??
                                templateStats.estimatedProfit,
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {templateDates.length > 0 && (
                      <div className="mt-4 rounded-xl border border-border bg-background p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Datas criadas
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {finishedDates.length} finalizada
                            {finishedDates.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {templateDates.slice(0, 4).map((eventDate) => (
                            <button
                              key={eventDate.id}
                              onClick={() => {
                                setTab("agenda");
                                setSelectedEventDate(eventDate);
                              }}
                              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-left hover:bg-secondary/40"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {formatDateTime(eventDate.startAt)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Público esperado:{" "}
                                  {eventDate.expectedAudience ?? "-"}
                                </p>
                              </div>
                              <StatusBadge
                                status={getEventDisplayStatus(eventDate)}
                              />
                            </button>
                          ))}

                          {templateDates.length > 4 && (
                            <p className="text-xs text-muted-foreground">
                              +{templateDates.length - 4} datas adicionais
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button
                        onClick={() => openNewDate(template)}
                        className="h-9 rounded-lg bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Agendar
                      </button>

                      <button
                        onClick={() => openEditTemplate(template)}
                        className="h-9 rounded-lg border border-border bg-background text-xs font-medium hover:bg-secondary"
                      >
                        Editar
                      </button>

                      <button
                        onClick={() => handleDeleteTemplate(template)}
                        className="h-9 rounded-lg bg-destructive/15 text-xs font-medium text-destructive hover:bg-destructive/25"
                      >
                        Desativar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {costModalEvent && (
        <EventCostModal
          eventDate={costModalEvent}
          onClose={() => setCostModalEvent(null)}
        />
      )}

      {staffReviewEvent && (
        <StaffReviewModal
          eventDate={staffReviewEvent}
          staff={reviewStaff}
          criteria={reviewCriteria}
          isLoading={isLoadingReview}
          newCriterionName={newCriterionName}
          setNewCriterionName={setNewCriterionName}
          onCreateCriterion={handleCreateReviewCriterion}
          onSaved={reloadStaffReview}
          onClose={() => setStaffReviewEvent(null)}
        />
      )}

      {staffModalEvent && (
        <StaffManagementModal
          eventDate={staffModalEvent}
          people={people}
          onClose={() => setStaffModalEvent(null)}
          onStatusChange={handlePersonStatusChange}
          onWorkChange={handlePersonWorkChange}
          onRemovePerson={handleRemovePersonFromEventDate}
          onAddPerson={handleAddPersonToEventDate}
        />
      )}

      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="mobile-modal-shell flex h-[94svh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[2rem] border border-border bg-card shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {modalMode === "template"
                    ? editingTemplate
                      ? "Editar evento"
                      : "Novo evento"
                    : editingDate
                      ? "Editar data"
                      : "Agendar evento"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {modalMode === "template"
                    ? "Configure um modelo reutilizável de evento."
                    : "Crie ou edite uma data na agenda."}
                </p>
              </div>

              <button
                onClick={() => setModalMode(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="event-main-modal-body min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
              {modalMode === "template" ? (
                <div className="space-y-5">
                  <ModalSectionHeader
                    title="Dados do evento"
                    description="Defina o nome e a descrição do modelo que será reutilizado na agenda."
                  />

                  <input
                    value={templateForm.title}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Título do evento"
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />

                  <textarea
                    value={templateForm.description}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Descrição"
                    className="min-h-20 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />

                  <ModalSectionHeader
                    title="Padrões de planejamento"
                    description="Valores sugeridos automaticamente quando você criar uma nova data desse evento."
                  />

                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="number"
                      value={templateForm.defaultExpectedAudience}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          defaultExpectedAudience: event.target.value,
                        }))
                      }
                      placeholder="Público esperado padrão"
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    />

                    <input
                      type="time"
                      value={templateForm.defaultStartTime}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          defaultStartTime: event.target.value,
                        }))
                      }
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    />

                    <input
                      type="time"
                      value={templateForm.defaultEndTime}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          defaultEndTime: event.target.value,
                        }))
                      }
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </div>

                  <select
                    value={templateForm.salesEnvironmentId}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({
                        ...prev,
                        salesEnvironmentId: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    {defaultSalesEnvironment && (
                      <option value={defaultSalesEnvironment.id}>Padrão</option>
                    )}
                    {selectableSalesEnvironments.map((environment) => (
                      <option key={environment.id} value={environment.id}>
                        {environment.name}
                      </option>
                    ))}
                  </select>

                  <ModalSectionHeader
                    title="Observações e equipe"
                    description="Registre instruções internas e monte a equipe fixa do evento."
                  />

                  <textarea
                    value={templateForm.notes}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Observações internas"
                    className="min-h-20 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />

                  <PeopleEditor
                    title="Equipe fixa"
                    people={people}
                    selectedPeople={templateForm.fixedPeople}
                    onAddPerson={addPersonToTemplate}
                    onChange={(fixedPeople) =>
                      setTemplateForm((prev) => ({ ...prev, fixedPeople }))
                    }
                  />
                </div>
              ) : (
                <div className="space-y-5">
                  <ModalSectionHeader
                    title="Origem do evento"
                    description="Escolha um modelo existente ou crie uma data singular sem modelo."
                  />

                  <select
                    value={dateForm.eventTemplateId}
                    onChange={(event) => {
                      const template = templates.find(
                        (item) => item.id === event.target.value,
                      );

                      if (!template) {
                        setDateForm((prev) => ({
                          ...prev,
                          eventTemplateId: "",
                        }));
                        return;
                      }

                      setDateForm((prev) => ({
                        ...prev,
                        eventTemplateId: template.id,
                        title: template.title,
                        description: template.description ?? "",
                        expectedAudience:
                          template.defaultExpectedAudience == null
                            ? prev.expectedAudience
                            : String(template.defaultExpectedAudience),
                        salesEnvironmentId:
                          template.salesEnvironmentId ??
                          defaultSalesEnvironment?.id ??
                          prev.salesEnvironmentId,
                        people: template.fixedPeople.map((item) => ({
                          personId: item.personId,
                          functionName: item.functionName ?? "",
                          status: "pending",
                          notes: item.notes ?? "",
                        })),
                      }));
                    }}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="">Evento singular / sem modelo</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                  </select>

                  <input
                    value={dateForm.title}
                    onChange={(event) =>
                      setDateForm((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Título da data"
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />

                  <ModalSectionHeader
                    title="Ambiente de venda"
                    description="Define quais preços serão usados no PDV quando esta data estiver ativa."
                  />

                  <select
                    value={dateForm.salesEnvironmentId}
                    onChange={(event) =>
                      setDateForm((prev) => ({
                        ...prev,
                        salesEnvironmentId: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    {defaultSalesEnvironment && (
                      <option value={defaultSalesEnvironment.id}>Padrão</option>
                    )}
                    {selectableSalesEnvironments.map((environment) => (
                      <option key={environment.id} value={environment.id}>
                        {environment.name}
                      </option>
                    ))}
                  </select>

                  <ModalSectionHeader
                    title="Data, horário e público"
                    description="Configure o período do evento. Depois do fim, ele aparece como Finalizado automaticamente."
                  />

                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="datetime-local"
                      value={dateForm.startAt}
                      onChange={(event) =>
                        setDateForm((prev) => ({
                          ...prev,
                          startAt: event.target.value,
                        }))
                      }
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    />

                    <input
                      type="datetime-local"
                      value={dateForm.endAt}
                      onChange={(event) =>
                        setDateForm((prev) => ({
                          ...prev,
                          endAt: event.target.value,
                        }))
                      }
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    />

                    <input
                      type="number"
                      value={dateForm.expectedAudience}
                      onChange={(event) =>
                        setDateForm((prev) => ({
                          ...prev,
                          expectedAudience: event.target.value,
                        }))
                      }
                      placeholder="Público esperado"
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </div>

                  <ModalSectionHeader
                    title="Status, observações e equipe"
                    description="Controle o estado da data e confirme quem vai trabalhar no evento."
                  />

                  <select
                    value={dateForm.status}
                    onChange={(event) =>
                      setDateForm((prev) => ({
                        ...prev,
                        status: event.target.value as EventDateStatus,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="scheduled">Agendado</option>
                    <option value="done">Finalizado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>

                  <textarea
                    value={dateForm.notes}
                    onChange={(event) =>
                      setDateForm((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Observações"
                    className="min-h-20 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />

                  <PeopleEditor
                    title="Equipe / músicos / staff"
                    people={people}
                    selectedPeople={dateForm.people}
                    showStatus
                    onAddPerson={addPersonToDate}
                    onChange={(selectedPeople) =>
                      setDateForm((prev) => ({
                        ...prev,
                        people: selectedPeople,
                      }))
                    }
                  />
                </div>
              )}
            </div>

            <div className="ordr-mobile-modal-footer flex justify-end gap-3 border-t border-border bg-card px-4 py-4 sm:px-5">
              <button
                onClick={() => setModalMode(null)}
                className="h-10 rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-secondary"
              >
                Cancelar
              </button>

              <button
                onClick={
                  modalMode === "template" ? saveTemplate : saveEventDate
                }
                disabled={isSaving}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventCostModal({
  eventDate,
  onClose,
}: {
  eventDate: EventDate;
  onClose: () => void;
}) {
  const activeStaff = eventDate.people.filter(
    (person) => person.status !== "declined",
  );
  const declinedStaff = eventDate.people.filter(
    (person) => person.status === "declined",
  );
  const buyRequests = getEventBuyRequests(eventDate);
  const staffTotal = getEventStaffCost(eventDate);
  const buyTotal = getEventBuyCost(eventDate);
  const total = staffTotal + buyTotal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Custos do evento
            </h2>
            <p className="text-sm text-muted-foreground">
              {eventDate.title} • {formatEventPeriod(eventDate)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 border-b border-border bg-background/60 p-5 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Custo de equipe</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {formatBRL(staffTotal)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeStaff.length} pessoa{activeStaff.length === 1 ? "" : "s"}{" "}
              considerada{activeStaff.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Custo de compras</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {formatBRL(buyTotal)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {buyRequests.length} compra{buyRequests.length === 1 ? "" : "s"}{" "}
              vinculada{buyRequests.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
            <p className="text-xs text-primary">Custo total estimado</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {formatBRL(total)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Equipe + compras recebidas/parciais.
            </p>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
          <section className="min-h-0 overflow-y-auto border-r border-border p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-foreground">
                  Detalhes da equipe
                </h3>
                <p className="text-xs text-muted-foreground">
                  Pessoas recusadas não entram no custo.
                </p>
              </div>
              <span className="rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                {formatBRL(staffTotal)}
              </span>
            </div>

            {activeStaff.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhum custo de equipe para este evento.
              </div>
            ) : (
              <div className="space-y-3">
                {activeStaff.map((person) => {
                  const cost = estimateLinkedPersonCost(eventDate, person);
                  const hours = getLinkedPersonWorkHours(eventDate, person);
                  const rateType = person.person.rateType ?? "EVENT";
                  const rateAmount = Number(person.person.rateAmount ?? 0);
                  const hasOverride = Number(person.costOverride ?? 0) > 0;

                  return (
                    <div
                      key={person.id}
                      className="rounded-2xl border border-border bg-background p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {person.person.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {person.functionName ||
                              personMainFunction(person.person)}{" "}
                            • {personStatusLabels[person.status ?? "pending"]}
                          </p>
                        </div>
                        <p className="font-semibold text-foreground">
                          {formatBRL(cost)}
                        </p>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                        <p>
                          Modelo:{" "}
                          <span className="font-medium text-foreground">
                            {rateType}
                          </span>
                        </p>
                        <p>
                          Valor base:{" "}
                          <span className="font-medium text-foreground">
                            {formatBRL(rateAmount)}
                          </span>
                        </p>
                        <p>
                          Horas:{" "}
                          <span className="font-medium text-foreground">
                            {formatHours(hours)}
                          </span>
                        </p>
                        <p>
                          Override:{" "}
                          <span className="font-medium text-foreground">
                            {hasOverride ? formatBRL(person.costOverride) : "-"}
                          </span>
                        </p>
                      </div>

                      {person.costNotes && (
                        <p className="mt-3 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                          {person.costNotes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {declinedStaff.length > 0 && (
              <div className="mt-4 rounded-2xl border border-border bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Não considerados
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {declinedStaff.map((person) => (
                    <span
                      key={person.id}
                      className="rounded-full border border-border bg-card px-2 py-1 text-xs text-muted-foreground"
                    >
                      {person.person.name} • recusou
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="min-h-0 overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-foreground">
                  Detalhes das compras
                </h3>
                <p className="text-xs text-muted-foreground">
                  Itens não comprados e compras canceladas não entram no total.
                </p>
              </div>
              <span className="rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                {formatBRL(buyTotal)}
              </span>
            </div>

            {buyRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhuma compra recebida vinculada a este evento.
              </div>
            ) : (
              <div className="space-y-3">
                {buyRequests.map((request) => {
                  const requestTotal = getBuyRequestTotal(request);
                  const activeItems = (request.items ?? []).filter(
                    isActuallyBoughtBuyItem,
                  );
                  const ignoredItemsCount =
                    (request.items ?? []).length - activeItems.length;

                  return (
                    <div
                      key={request.id}
                      className="rounded-2xl border border-border bg-background p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {request.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {request.supplierName || "Sem fornecedor"}
                            {request.createdAt
                              ? ` • ${formatDateTime(request.createdAt)}`
                              : ""}
                          </p>
                        </div>
                        <p className="font-semibold text-foreground">
                          {formatBRL(requestTotal)}
                        </p>
                      </div>

                      <div className="mt-3 space-y-2">
                        {activeItems.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                            Nenhum item comprado nesta solicitação.
                          </p>
                        ) : (
                          activeItems.map((item, index) => {
                            const itemCost = getBuyRequestItemCost(item);
                            const boughtQuantity = Number(
                              item.boughtQuantity ?? 0,
                            );
                            const unitPrice = Number(item.unitPrice ?? 0);

                            return (
                              <div
                                key={item.id ?? index}
                                className="rounded-xl border border-border bg-card px-3 py-2"
                              >
                                <div className="flex items-start justify-between gap-3 text-sm">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-foreground">
                                      {item.product?.name ?? "Item"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Comprado:{" "}
                                      {Number.isFinite(boughtQuantity)
                                        ? boughtQuantity.toLocaleString(
                                            "pt-BR",
                                            { maximumFractionDigits: 3 },
                                          )
                                        : "0"}{" "}
                                      {getBuyItemUnitLabel(item)}
                                      {unitPrice > 0
                                        ? ` • ${formatBRL(unitPrice)} / ${getBuyItemUnitLabel(item)}`
                                        : ""}
                                    </p>
                                  </div>
                                  <p className="shrink-0 font-semibold text-foreground">
                                    {formatBRL(itemCost)}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {ignoredItemsCount > 0 && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          {ignoredItemsCount} item
                          {ignoredItemsCount === 1 ? "" : "s"} pendente
                          {ignoredItemsCount === 1 ? "" : "s"}, sem preço ou
                          marcado{ignoredItemsCount === 1 ? "" : "s"} como não
                          comprado ficou{ignoredItemsCount === 1 ? "" : "ram"}{" "}
                          fora do custo.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function getReviewFunctionNamesForStaff(item: EventStaffReviewItem) {
  const explicitName = String((item as any).functionName ?? "").trim();

  if (explicitName && explicitName !== "Outros") {
    return splitFunctionNames(explicitName);
  }

  const linkedNames = getLinkedPersonFunctionNames(item as any).filter(
    (name) => name !== "Outros",
  );

  return linkedNames.length
    ? linkedNames
    : [personMainFunction(item.person as any)];
}

function getEvaluationForFunction(
  staffRows: EventStaffReviewItem[],
  personId: string,
  functionName: string,
) {
  return (
    staffRows.find(
      (item) =>
        item.personId === personId &&
        String(
          (item as any).evaluation?.functionName ??
            (item as any).functionName ??
            "",
        ) === functionName,
    )?.evaluation ?? null
  );
}

function StaffReviewModal({
  eventDate,
  staff,
  criteria,
  isLoading,
  newCriterionName,
  setNewCriterionName,
  onCreateCriterion,
  onSaved,
  onClose,
}: {
  eventDate: EventDate;
  staff: EventStaffReviewItem[];
  criteria: StaffEvaluationCriterion[];
  isLoading: boolean;
  newCriterionName: string;
  setNewCriterionName: (value: string) => void;
  onCreateCriterion: () => Promise<void>;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedTabByPerson, setSelectedTabByPerson] = useState<
    Record<string, string>
  >({});
  const [hiddenOutrosPersonIds, setHiddenOutrosPersonIds] = useState<string[]>(
    [],
  );
  const [hiddenFunctionKeys, setHiddenFunctionKeys] = useState<string[]>([]);

  const groupedReviewStaff = useMemo(() => {
    const groups = new Map<
      string,
      {
        personId: string;
        person: EventStaffReviewItem["person"];
        rows: EventStaffReviewItem[];
        functions: string[];
        outrosEvaluation: EventStaffReviewItem["evaluation"] | null;
      }
    >();

    for (const item of staff) {
      const current = groups.get(item.personId) ?? {
        personId: item.personId,
        person: item.person,
        rows: [] as EventStaffReviewItem[],
        functions: [] as string[],
        outrosEvaluation: null,
      };

      current.rows.push(item);

      const rawFunctionName = String((item as any).functionName ?? "").trim();
      const evaluationFunctionName = String(
        (item as any).evaluation?.functionName ?? "",
      ).trim();

      if (rawFunctionName === "Outros" || evaluationFunctionName === "Outros") {
        current.outrosEvaluation = item.evaluation ?? current.outrosEvaluation;
      } else {
        for (const functionName of getReviewFunctionNamesForStaff(item)) {
          if (!current.functions.includes(functionName)) {
            current.functions.push(functionName);
          }
        }
      }

      groups.set(item.personId, current);
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        functions: group.functions.length
          ? group.functions.sort((a, b) => a.localeCompare(b))
          : [personMainFunction(group.person as any)],
      }))
      .sort((a, b) => a.person.name.localeCompare(b.person.name));
  }, [staff]);

  const selectedGroup =
    groupedReviewStaff.find((group) => group.personId === selectedPersonId) ??
    groupedReviewStaff[0] ??
    null;

  const selectedTab = selectedGroup
    ? (selectedTabByPerson[selectedGroup.personId] ??
      selectedGroup.functions[0] ??
      "Outros")
    : "";

  useEffect(() => {
    if (!groupedReviewStaff.length) {
      setSelectedPersonId("");
      return;
    }

    const selectedStillExists = groupedReviewStaff.some(
      (group) => group.personId === selectedPersonId,
    );

    if (!selectedPersonId || !selectedStillExists) {
      setSelectedPersonId(groupedReviewStaff[0].personId);
    }
  }, [groupedReviewStaff, selectedPersonId]);

  useEffect(() => {
    setHiddenFunctionKeys((current) => {
      const validKeys = new Set(
        groupedReviewStaff.flatMap((group) =>
          group.functions.map((functionName) =>
            `${group.personId}:${functionName}`,
          ),
        ),
      );

      return current.filter((key) => validKeys.has(key));
    });
  }, [groupedReviewStaff]);

  useEffect(() => {
    setHiddenOutrosPersonIds((current) => {
      const validIds = new Set(
        groupedReviewStaff.map((group) => group.personId),
      );
      return current.filter((personId) => validIds.has(personId));
    });
  }, [groupedReviewStaff]);

  useEffect(() => {
    if (!selectedGroup) return;

    const outrosHidden = hiddenOutrosPersonIds.includes(selectedGroup.personId);
    const availableTabs = [
      ...getVisibleFunctions(selectedGroup),
      ...(outrosHidden ? [] : ["Outros"]),
    ];

    if (availableTabs.length === 0) return;

    if (!availableTabs.includes(selectedTab)) {
      setSelectedTabByPerson((current) => ({
        ...current,
        [selectedGroup.personId]: availableTabs[0],
      }));
    }
  }, [selectedGroup, selectedTab, hiddenOutrosPersonIds, hiddenFunctionKeys]);

  function selectPerson(personId: string) {
    setSelectedPersonId(personId);
  }

  function selectTab(personId: string, tab: string) {
    setSelectedTabByPerson((current) => ({
      ...current,
      [personId]: tab,
    }));
  }

  function getFunctionKey(personId: string, functionName: string) {
    return `${personId}:${functionName}`;
  }

  function isFunctionHidden(personId: string, functionName: string) {
    return hiddenFunctionKeys.includes(getFunctionKey(personId, functionName));
  }

  function getVisibleFunctions(group: ReviewPersonGroup) {
    return group.functions.filter(
      (functionName) => !isFunctionHidden(group.personId, functionName),
    );
  }

  function removeFunctionForPerson(personId: string, functionName: string) {
    const key = getFunctionKey(personId, functionName);

    setHiddenFunctionKeys((current) =>
      current.includes(key) ? current : [...current, key],
    );

    const group = groupedReviewStaff.find((item) => item.personId === personId);
    if (!group) return;

    const nextVisibleFunction = group.functions.find(
      (item) =>
        item !== functionName &&
        !hiddenFunctionKeys.includes(getFunctionKey(personId, item)),
    );

    if (nextVisibleFunction) {
      selectTab(personId, nextVisibleFunction);
      return;
    }

    if (!hiddenOutrosPersonIds.includes(personId)) {
      selectTab(personId, "Outros");
    }
  }

  function restoreFunctionForPerson(personId: string, functionName: string) {
    const key = getFunctionKey(personId, functionName);
    setHiddenFunctionKeys((current) => current.filter((item) => item !== key));
    selectPerson(personId);
    selectTab(personId, functionName);
  }

  function removeOutrosForPerson(personId: string) {
    setHiddenOutrosPersonIds((current) =>
      current.includes(personId) ? current : [...current, personId],
    );

    const group = groupedReviewStaff.find((item) => item.personId === personId);
    const nextTab = group?.functions[0];

    if (nextTab) {
      selectTab(personId, nextTab);
    }
  }

  function restoreOutrosForPerson(personId: string) {
    setHiddenOutrosPersonIds((current) =>
      current.filter((item) => item !== personId),
    );
    selectPerson(personId);
    selectTab(personId, "Outros");
  }

  function getPersonEvaluationState(group: NonNullable<typeof selectedGroup>) {
    const visibleFunctions = getVisibleFunctions(group);
    const outrosVisible = !hiddenOutrosPersonIds.includes(group.personId);

    const functionEvaluations = visibleFunctions.filter((functionName) =>
      Boolean(
        getEvaluationForFunction(group.rows, group.personId, functionName),
      ),
    ).length;
    const hasOutros = outrosVisible && Boolean(group.outrosEvaluation);
    const totalTabs = visibleFunctions.length + (outrosVisible ? 1 : 0);
    const evaluatedTabs = functionEvaluations + (hasOutros ? 1 : 0);

    if (totalTabs <= 0 || evaluatedTabs <= 0) return "pending";
    if (evaluatedTabs >= totalTabs) return "done";
    return "partial";
  }

  function getEvaluationCardClass(
    state: "pending" | "partial" | "done",
    selected = false,
  ) {
    if (selected) return "border-primary bg-primary/10 ring-2 ring-primary/20";
    if (state === "done") return "border-success/30 bg-success/10";
    if (state === "partial") return "border-warning/30 bg-warning/10";
    return "border-border bg-background hover:bg-secondary/40";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Revisar equipe
            </h2>
            <p className="text-sm text-muted-foreground">{eventDate.title}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex h-80 items-center justify-center text-muted-foreground">
            Carregando avaliações...
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr] overflow-hidden">
            <aside className="overflow-y-auto border-r border-border p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Confirmados
              </p>

              {groupedReviewStaff.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Nenhuma pessoa disponível para avaliação.
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedReviewStaff.map((group) => {
                    const state = getPersonEvaluationState(group);
                    const selected = group.personId === selectedGroup?.personId;
                    const visibleFunctions = getVisibleFunctions(group);
                    const evaluatedFunctions = visibleFunctions.filter(
                      (functionName) =>
                        Boolean(
                          getEvaluationForFunction(
                            group.rows,
                            group.personId,
                            functionName,
                          ),
                        ),
                    ).length;

                    return (
                      <button
                        key={group.personId}
                        type="button"
                        onClick={() => selectPerson(group.personId)}
                        className={`w-full rounded-2xl border p-3 text-left transition ${getEvaluationCardClass(
                          state,
                          selected,
                        )}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {group.person.name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {visibleFunctions.length} função
                              {visibleFunctions.length === 1 ? "" : "ões"} •{" "}
                              {evaluatedFunctions} avaliada
                              {evaluatedFunctions === 1 ? "" : "s"}
                            </p>
                          </div>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                              state === "done"
                                ? "border-success/30 bg-success/10 text-success"
                                : state === "partial"
                                  ? "border-warning/30 bg-warning/10 text-warning"
                                  : "border-border bg-card text-muted-foreground"
                            }`}
                          >
                            {state === "done"
                              ? "Completo"
                              : state === "partial"
                                ? "Parcial"
                                : "Pendente"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {hiddenFunctionKeys.length > 0 && (
                <div className="mt-4 rounded-2xl border border-border bg-background p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Funções removidas
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {hiddenFunctionKeys.map((key) => {
                      const [personId, ...functionNameParts] = key.split(":");
                      const functionName = functionNameParts.join(":");
                      const group = groupedReviewStaff.find(
                        (item) => item.personId === personId,
                      );
                      if (!group) return null;

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            restoreFunctionForPerson(personId, functionName)
                          }
                          className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          Restaurar {group.person.name} • {functionName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {hiddenOutrosPersonIds.length > 0 && (
                <div className="mt-4 rounded-2xl border border-border bg-background p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Abas Outros removidas
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {hiddenOutrosPersonIds.map((personId) => {
                      const group = groupedReviewStaff.find(
                        (item) => item.personId === personId,
                      );
                      if (!group) return null;

                      return (
                        <button
                          key={personId}
                          type="button"
                          onClick={() => restoreOutrosForPerson(personId)}
                          className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          Restaurar Outros • {group.person.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </aside>

            <main className="overflow-y-auto p-5">
              <div className="mb-5 rounded-xl border border-border bg-background p-4">
                <p className="mb-2 text-sm font-medium text-foreground">
                  Adicionar novo parâmetro
                </p>
                <div className="flex gap-2">
                  <input
                    value={newCriterionName}
                    onChange={(event) =>
                      setNewCriterionName(event.target.value)
                    }
                    placeholder="Ex: Atendimento ao cliente, Postura, Comunicação..."
                    className="h-10 flex-1 rounded-lg border border-border bg-card px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={onCreateCriterion}
                    disabled={!newCriterionName.trim()}
                    className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {selectedGroup ? (
                <StaffEvaluationTabs
                  eventDateId={eventDate.id}
                  group={selectedGroup}
                  selectedTab={selectedTab}
                  criteria={criteria}
                  outrosHidden={hiddenOutrosPersonIds.includes(
                    selectedGroup.personId,
                  )}
                  hiddenFunctionNames={selectedGroup.functions.filter(
                    (functionName) =>
                      isFunctionHidden(selectedGroup.personId, functionName),
                  )}
                  onSelectTab={(tab) => selectTab(selectedGroup.personId, tab)}
                  onRemoveFunction={(functionName) =>
                    removeFunctionForPerson(selectedGroup.personId, functionName)
                  }
                  onRemoveOutros={() =>
                    removeOutrosForPerson(selectedGroup.personId)
                  }
                  onSaved={onSaved}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
                  Nenhuma pessoa confirmada para revisar.
                </div>
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}

type ReviewPersonGroup = {
  personId: string;
  person: EventStaffReviewItem["person"];
  rows: EventStaffReviewItem[];
  functions: string[];
  outrosEvaluation: EventStaffReviewItem["evaluation"] | null;
};

function StaffEvaluationTabs({
  eventDateId,
  group,
  selectedTab,
  criteria,
  outrosHidden,
  hiddenFunctionNames,
  onSelectTab,
  onRemoveFunction,
  onRemoveOutros,
  onSaved,
}: {
  eventDateId: string;
  group: ReviewPersonGroup;
  selectedTab: string;
  criteria: StaffEvaluationCriterion[];
  outrosHidden: boolean;
  hiddenFunctionNames: string[];
  onSelectTab: (tab: string) => void;
  onRemoveFunction: (functionName: string) => void;
  onRemoveOutros: () => void;
  onSaved: () => Promise<void>;
}) {
  const visibleFunctions = group.functions.filter(
    (functionName) => !hiddenFunctionNames.includes(functionName),
  );
  const availableTabs = [
    ...visibleFunctions,
    ...(outrosHidden ? [] : ["Outros"]),
  ];
  const activeTab = availableTabs.includes(selectedTab)
    ? selectedTab
    : (availableTabs[0] ?? "");

  const functionEvaluation =
    activeTab === "Outros"
      ? group.outrosEvaluation
      : getEvaluationForFunction(group.rows, group.personId, activeTab);

  function getTabState(tab: string) {
    const evaluation =
      tab === "Outros"
        ? group.outrosEvaluation
        : getEvaluationForFunction(group.rows, group.personId, tab);

    return evaluation ? "done" : "pending";
  }

  if (!activeTab) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Nenhuma aba disponível para esta pessoa.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          {group.person.name}
        </h3>
        <p className="text-sm text-muted-foreground">
          Avalie cada função em sua própria aba. Use Outros para parâmetros
          manuais.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-background p-2">
        {visibleFunctions.map((functionName) => {
          const selected = activeTab === functionName;
          const state = getTabState(functionName);

          return (
            <div
              key={functionName}
              className={`flex items-center overflow-hidden rounded-xl border transition ${
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : state === "done"
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-border bg-card text-muted-foreground"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectTab(functionName)}
                className="px-4 py-2 text-sm font-medium"
              >
                {functionName}
              </button>
              <button
                type="button"
                onClick={() => onRemoveFunction(functionName)}
                className={`flex h-9 w-9 items-center justify-center ${
                  selected
                    ? "hover:bg-primary-foreground/15"
                    : "hover:bg-destructive/10 hover:text-destructive"
                }`}
                title="Remover esta função desta revisão"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        {!outrosHidden && (
          <div
            className={`flex items-center overflow-hidden rounded-xl border transition ${
              activeTab === "Outros"
                ? "border-primary bg-primary text-primary-foreground"
                : getTabState("Outros") === "done"
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-border bg-card text-muted-foreground"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectTab("Outros")}
              className="px-4 py-2 text-sm font-medium"
            >
              Outros
            </button>
            <button
              type="button"
              onClick={onRemoveOutros}
              className={`flex h-9 w-9 items-center justify-center ${
                activeTab === "Outros"
                  ? "hover:bg-primary-foreground/15"
                  : "hover:bg-destructive/10 hover:text-destructive"
              }`}
              title="Remover aba Outros desta revisão"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {activeTab === "Outros" ? (
        <StaffOutrosEvaluationForm
          key={`${group.personId}:Outros`}
          eventDateId={eventDateId}
          personId={group.personId}
          personName={group.person.name}
          evaluation={functionEvaluation}
          criteria={criteria}
          onSaved={onSaved}
        />
      ) : (
        <StaffFunctionEvaluationForm
          key={`${group.personId}:${activeTab}`}
          eventDateId={eventDateId}
          personId={group.personId}
          personName={group.person.name}
          functionName={activeTab}
          evaluation={functionEvaluation}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

function StaffFunctionEvaluationForm({
  eventDateId,
  personId,
  personName,
  functionName,
  evaluation,
  onSaved,
}: {
  eventDateId: string;
  personId: string;
  personName: string;
  functionName: string;
  evaluation: EventStaffReviewItem["evaluation"] | null | undefined;
  onSaved: () => Promise<void>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [generalNotes, setGeneralNotes] = useState(
    evaluation?.generalNotes ?? "",
  );
  const [functionScore, setFunctionScore] = useState(
    evaluation?.functionScore ?? 3,
  );

  useEffect(() => {
    setFunctionScore(evaluation?.functionScore ?? 3);
    setGeneralNotes(evaluation?.generalNotes ?? "");
  }, [evaluation, functionName]);

  async function handleSave() {
    try {
      setIsSaving(true);
      await saveStaffEvaluation(eventDateId, {
        personId,
        functionName,
        functionScore,
        generalNotes: generalNotes || null,
        scores: [],
      });
      await onSaved();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-foreground">{functionName}</p>
            <p className="text-xs text-muted-foreground">
              Nota da função exercida por {personName} neste evento.
            </p>
          </div>
          <span className="text-sm font-semibold text-primary">
            {functionScore}/5
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={functionScore}
          onChange={(event) => setFunctionScore(Number(event.target.value))}
          className="w-full"
        />
      </div>

      <div className="rounded-2xl border border-border bg-background p-4">
        <p className="mb-2 text-sm font-medium text-foreground">
          Observações da função
        </p>
        <textarea
          value={generalNotes}
          onChange={(event) => setGeneralNotes(event.target.value)}
          placeholder={`Observações sobre ${personName} como ${functionName}...`}
          className="min-h-24 w-full rounded-xl border border-border bg-card p-3 text-sm"
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
        Salvar função
      </button>
    </div>
  );
}

function StaffOutrosEvaluationForm({
  eventDateId,
  personId,
  personName,
  evaluation,
  criteria,
  onSaved,
}: {
  eventDateId: string;
  personId: string;
  personName: string;
  evaluation: EventStaffReviewItem["evaluation"] | null | undefined;
  criteria: StaffEvaluationCriterion[];
  onSaved: () => Promise<void>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [generalNotes, setGeneralNotes] = useState(
    evaluation?.generalNotes ?? "",
  );
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const criterion of criteria) {
      const existing = evaluation?.scores?.find(
        (score) => score.criterionId === criterion.id,
      );
      initial[criterion.id] = existing?.score ?? 3;
    }
    return initial;
  });
  const [hiddenCriterionIds, setHiddenCriterionIds] = useState<string[]>([]);

  const visibleCriteria = criteria.filter(
    (criterion) => !hiddenCriterionIds.includes(criterion.id),
  );

  useEffect(() => {
    const next: Record<string, number> = {};
    const existingScores = evaluation?.scores ?? [];
    const existingScoreIds = new Set(
      existingScores.map((score) => score.criterionId),
    );
    const isExistingEvaluation = Boolean(evaluation);

    for (const criterion of criteria) {
      const existing = existingScores.find(
        (score) => score.criterionId === criterion.id,
      );
      next[criterion.id] = existing?.score ?? 3;
    }

    setScores(next);
    setHiddenCriterionIds(
      isExistingEvaluation
        ? criteria
            .filter((criterion) => !existingScoreIds.has(criterion.id))
            .map((criterion) => criterion.id)
        : [],
    );
    setGeneralNotes(evaluation?.generalNotes ?? "");
  }, [evaluation, criteria]);

  function removeCriterionFromThisReview(criterionId: string) {
    setHiddenCriterionIds((current) =>
      current.includes(criterionId) ? current : [...current, criterionId],
    );
  }

  function restoreCriterionToThisReview(criterionId: string) {
    setHiddenCriterionIds((current) =>
      current.filter((id) => id !== criterionId),
    );
  }

  async function handleSave() {
    try {
      setIsSaving(true);
      await saveStaffEvaluation(eventDateId, {
        personId,
        functionName: "Outros",
        functionScore: 3,
        generalNotes: generalNotes || null,
        scores: visibleCriteria.map((criterion) => ({
          criterionId: criterion.id,
          score: scores[criterion.id] ?? 3,
        })),
      });
      await onSaved();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4">
        <p className="font-medium text-foreground">Outros parâmetros</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Use esta aba para avaliar critérios manuais de {personName}. Ela pode
          ser removida da revisão desta pessoa.
        </p>
      </div>

      {visibleCriteria.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum parâmetro ativo nesta aba.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleCriteria.map((criterion) => (
            <div
              key={criterion.id}
              className="rounded-xl border border-border bg-background p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {criterion.name}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold text-primary">
                    {scores[criterion.id] ?? 3}/5
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCriterionFromThisReview(criterion.id)}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Remover este parâmetro só desta avaliação"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={scores[criterion.id] ?? 3}
                onChange={(event) =>
                  setScores((current) => ({
                    ...current,
                    [criterion.id]: Number(event.target.value),
                  }))
                }
                className="w-full"
              />
            </div>
          ))}
        </div>
      )}

      {hiddenCriterionIds.length > 0 && (
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Parâmetros removidos desta aba
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {hiddenCriterionIds.map((criterionId) => {
              const criterion = criteria.find(
                (item) => item.id === criterionId,
              );
              if (!criterion) return null;

              return (
                <button
                  key={criterionId}
                  type="button"
                  onClick={() => restoreCriterionToThisReview(criterionId)}
                  className="rounded-full border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  {criterion.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-background p-4">
        <p className="mb-2 text-sm font-medium text-foreground">
          Observações gerais
        </p>
        <textarea
          value={generalNotes}
          onChange={(event) => setGeneralNotes(event.target.value)}
          placeholder="Observações sobre os parâmetros manuais..."
          className="min-h-24 w-full rounded-xl border border-border bg-card p-3 text-sm"
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
        Salvar Outros
      </button>
    </div>
  );
}

function StaffManagementModal({
  eventDate,
  people,
  onClose,
  onStatusChange,
  onWorkChange,
  onRemovePerson,
  onAddPerson,
}: {
  eventDate: EventDate;
  people: EventPerson[];
  onClose: () => void;
  onStatusChange: (
    eventDate: EventDate,
    linkedPerson: EventLinkedPerson,
    status: EventPersonStatus,
  ) => void | Promise<void>;
  onWorkChange: (
    eventDate: EventDate,
    linkedPerson: EventLinkedPerson,
    patch: {
      worksFullEvent?: boolean;
      workHours?: number | string | null;
      costOverride?: number | string | null;
      costNotes?: string | null;
    },
  ) => void | Promise<void>;
  onRemovePerson: (
    eventDate: EventDate,
    linkedPerson: EventLinkedPerson,
  ) => void | Promise<void>;
  onAddPerson: (
    eventDate: EventDate,
    personId: string,
    functionNames?: string[] | string | null,
  ) => void | Promise<void>;
}) {
  const peopleSummary = getPeopleSummary(eventDate.people);
  const availablePeople = people.filter((person) => {
    return getAvailableFunctionNamesForPerson(person, eventDate).length > 0;
  });
  const [personToAddId, setPersonToAddId] = useState("");
  const [functionsToAdd, setFunctionsToAdd] = useState<string[]>([]);
  const personToAdd =
    availablePeople.find((person) => person.id === personToAddId) ?? null;
  const functionOptions = personToAdd
    ? getAvailableFunctionNamesForPerson(personToAdd, eventDate)
    : [];
  const groupedStaff = useMemo(() => {
    const groups = new Map<string, EventLinkedPerson[]>();

    for (const item of eventDate.people) {
      const current = groups.get(item.personId) ?? [];
      current.push(item);
      groups.set(item.personId, current);
    }

    return Array.from(groups.values()).map((items) => ({
      person: items[0].person,
      items,
      totalCost: items.reduce(
        (sum, item) => sum + estimateLinkedPersonCost(eventDate, item),
        0,
      ),
    }));
  }, [eventDate]);

  useEffect(() => {
    setFunctionsToAdd(functionOptions[0] ? [functionOptions[0]] : []);
  }, [personToAddId]);

  function toggleFunctionToAdd(functionName: string) {
    setFunctionsToAdd((current) =>
      current.includes(functionName)
        ? current.filter((item) => item !== functionName)
        : [...current, functionName],
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Equipe do evento
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {eventDate.title} • {peopleSummary.confirmed}/
              {peopleSummary.total} confirmados
            </p>
            <p className="mt-1 text-xs font-medium text-primary">
              Custo estimado da equipe:{" "}
              {formatBRL(getEventStaffCost(eventDate))}
            </p>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {availablePeople.length > 0 && (
            <div className="mb-4 rounded-xl border border-border bg-background p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Adicionar staff
              </p>
              <div className="grid gap-2 md:grid-cols-[1fr_1.4fr_auto]">
                <select
                  value={personToAddId}
                  onChange={(event) => setPersonToAddId(event.target.value)}
                  className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
                >
                  <option value="">Selecionar pessoa</option>
                  {availablePeople.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>

                <div className="rounded-lg border border-border bg-card p-2">
                  {!personToAddId ? (
                    <p className="text-xs text-muted-foreground">
                      Selecione uma pessoa
                    </p>
                  ) : functionOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Sem funções disponíveis
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {functionOptions.map((functionName) => {
                        const checked = functionsToAdd.includes(functionName);

                        return (
                          <button
                            key={functionName}
                            type="button"
                            onClick={() => toggleFunctionToAdd(functionName)}
                            className={`rounded-full border px-2 py-1 text-xs font-medium transition ${
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {functionName}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!personToAddId || functionsToAdd.length === 0}
                  onClick={async () => {
                    await onAddPerson(eventDate, personToAddId, functionsToAdd);
                    setPersonToAddId("");
                    setFunctionsToAdd([]);
                  }}
                  className="h-10 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Adicionar
                </button>
              </div>
            </div>
          )}
          {eventDate.people.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
              Nenhuma pessoa vinculada a esta data.
            </div>
          ) : (
            <div className="space-y-3">
              {groupedStaff.map((group) => (
                <div
                  key={group.person.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {group.person.name}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {group.items.map((item) => (
                          <span
                            key={item.id}
                            className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {item.functionName ||
                              personMainFunction(item.person)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Custo total
                      </p>
                      <p className="font-semibold text-foreground">
                        {formatBRL(group.totalCost)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border bg-card p-3"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {item.functionName ||
                                personMainFunction(item.person)}
                            </p>
                            <PersonStatusBadge status={item.status} />
                          </div>
                          <p className="text-sm font-semibold text-foreground">
                            {formatBRL(
                              estimateLinkedPersonCost(eventDate, item),
                            )}
                          </p>
                        </div>

                        <div className="grid gap-3 rounded-xl border border-border bg-background p-3 md:grid-cols-[1fr_120px_140px]">
                          <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={item.worksFullEvent ?? true}
                              onChange={(event) =>
                                onWorkChange(eventDate, item, {
                                  worksFullEvent: event.target.checked,
                                  workHours: event.target.checked
                                    ? null
                                    : (item.workHours ?? ""),
                                })
                              }
                            />
                            Evento inteiro
                          </label>

                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            disabled={item.worksFullEvent ?? true}
                            value={
                              item.workHours == null
                                ? ""
                                : String(item.workHours)
                            }
                            onChange={(event) =>
                              onWorkChange(eventDate, item, {
                                worksFullEvent: false,
                                workHours: event.target.value,
                              })
                            }
                            placeholder="Horas"
                            className="h-9 rounded-lg border border-border bg-card px-3 text-xs disabled:opacity-50"
                          />

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              item.costOverride == null
                                ? ""
                                : String(item.costOverride)
                            }
                            onChange={(event) =>
                              onWorkChange(eventDate, item, {
                                costOverride: event.target.value,
                              })
                            }
                            placeholder="Custo manual"
                            className="h-9 rounded-lg border border-border bg-card px-3 text-xs"
                          />

                          <div className="md:col-span-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>
                              Horas:{" "}
                              {formatHours(
                                getLinkedPersonWorkHours(eventDate, item),
                              )}
                            </span>
                            <span className="font-semibold text-foreground">
                              Custo:{" "}
                              {formatBRL(
                                estimateLinkedPersonCost(eventDate, item),
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                          <button
                            onClick={() =>
                              onStatusChange(eventDate, item, "confirmed")
                            }
                            className="h-9 rounded-lg bg-success/15 text-xs font-medium text-success hover:bg-success/25"
                          >
                            Confirmar
                          </button>

                          <button
                            onClick={() =>
                              onStatusChange(eventDate, item, "maybe")
                            }
                            className="h-9 rounded-lg bg-warning/15 text-xs font-medium text-warning hover:bg-warning/25"
                          >
                            Talvez
                          </button>

                          <button
                            onClick={() =>
                              onStatusChange(eventDate, item, "declined")
                            }
                            className="h-9 rounded-lg bg-destructive/15 text-xs font-medium text-destructive hover:bg-destructive/25"
                          >
                            Recusou
                          </button>

                          <button
                            onClick={() =>
                              onStatusChange(eventDate, item, "pending")
                            }
                            className="h-9 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            Limpar
                          </button>

                          <button
                            onClick={() => onRemovePerson(eventDate, item)}
                            className="h-9 rounded-lg bg-destructive text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}{" "}
        </div>

        <div className="flex justify-end border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            className="h-10 rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-secondary"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function PeopleEditor({
  title,
  people,
  selectedPeople,
  showStatus = false,
  onAddPerson,
  onChange,
}: {
  title: string;
  people: EventPerson[];
  selectedPeople: SaveEventPersonInput[];
  showStatus?: boolean;
  onAddPerson: (personId: string) => void;
  onChange: (people: SaveEventPersonInput[]) => void;
}) {
  const availablePeople = people;

  function updatePerson(index: number, patch: Partial<SaveEventPersonInput>) {
    onChange(
      selectedPeople.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function removePerson(index: number) {
    onChange(selectedPeople.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-foreground">{title}</h3>

        <select
          value=""
          onChange={(event) => onAddPerson(event.target.value)}
          className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
        >
          <option value="">Adicionar pessoa</option>
          {availablePeople.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </div>

      {selectedPeople.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma pessoa adicionada.
        </p>
      ) : (
        <div className="space-y-2">
          {selectedPeople.map((item, index) => {
            const person = people.find(
              (personItem) => personItem.id === item.personId,
            );

            return (
              <div
                key={`${item.personId}-${index}`}
                className="grid grid-cols-[1fr_160px_140px_36px] items-center gap-2 rounded-lg border border-border bg-card p-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {person?.name ?? "Pessoa"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {person?.functions
                      ?.map((fn) => fn.function.name)
                      .join(", ") || "Sem função"}
                  </p>
                </div>

                <select
                  value={
                    item.functionName ??
                    (person ? personMainFunction(person as EventPerson) : "")
                  }
                  onChange={(event) =>
                    updatePerson(index, {
                      functionName: event.target.value,
                    })
                  }
                  className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                >
                  {person ? (
                    getPersonFunctionNames(person as EventPerson).map(
                      (functionName) => (
                        <option key={functionName} value={functionName}>
                          {functionName}
                        </option>
                      ),
                    )
                  ) : (
                    <option value="">Função</option>
                  )}
                </select>

                {showStatus ? (
                  <select
                    value={item.status ?? "pending"}
                    onChange={(event) =>
                      updatePerson(index, {
                        status: event.target.value as EventPersonStatus,
                      })
                    }
                    className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                  >
                    <option value="pending">Pendente</option>
                    <option value="confirmed">Confirmado</option>
                    <option value="maybe">Talvez</option>
                    <option value="declined">Recusou</option>
                  </select>
                ) : (
                  <input
                    value={item.notes ?? ""}
                    onChange={(event) =>
                      updatePerson(index, {
                        notes: event.target.value,
                      })
                    }
                    placeholder="Obs."
                    className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                  />
                )}

                <button
                  onClick={() => removePerson(index)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
