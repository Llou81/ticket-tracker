import { memo, useState, type KeyboardEvent } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import type { TicketSummary } from "../api/tickets";
import { STATE_LABELS, TICKET_STATES, TYPE_LABELS, type TicketState } from "../tickets";

interface Props {
  /** Tickets grouped by state, each column already in display order. */
  columns: Record<TicketState, TicketSummary[]>;
  /** Total per state before filtering, for the column header. */
  totals: Record<TicketState, number>;
  savingIds: ReadonlySet<string>;
  onMove: (ticket: TicketSummary, to: TicketState) => void;
  onOpen: (ticket: TicketSummary) => void;
}

// Pointer: prefer the column under the cursor. Keyboard: fall back to overlap.
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

/** Left/Right arrows jump the dragged card to the neighbouring column. */
const columnJumpCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const { collisionRect, droppableRects, droppableContainers } = context;
  if (!collisionRect || (event.code !== "ArrowRight" && event.code !== "ArrowLeft")) return undefined;
  event.preventDefault();

  const columns = droppableContainers
    .getEnabled()
    .map((c) => droppableRects.get(c.id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .sort((a, b) => a.left - b.left);
  const centerX = collisionRect.left + collisionRect.width / 2;
  const current = columns.findIndex((r) => centerX >= r.left && centerX <= r.right);
  const target = columns[(current === -1 ? 0 : current) + (event.code === "ArrowRight" ? 1 : -1)];
  if (!target) return undefined;
  return { x: target.left + (target.width - collisionRect.width) / 2, y: collisionRect.top };
};

export function KanbanBoard({ columns, totals, savingIds, onMove, onOpen }: Props) {
  const [active, setActive] = useState<TicketSummary | null>(null);
  const sensors = useSensors(
    // A small distance keeps plain clicks working as "open ticket".
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: columnJumpCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  const findTicket = (id: string | number) => {
    for (const state of TICKET_STATES) {
      const found = columns[state].find((t) => t.id === id);
      if (found) return found;
    }
    return null;
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ticket ${findTicket(active.id)?.title ?? ""}. Use left and right arrows to change column.`,
    onDragOver: ({ over }) => (over ? `Over column ${STATE_LABELS[over.id as TicketState]}.` : "Not over a column."),
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ticket ${findTicket(active.id)?.title ?? ""} in ${STATE_LABELS[over.id as TicketState]}.`
        : "Dropped outside the board; nothing changed.",
    onDragCancel: () => "Move cancelled.",
  };

  function handleDragStart(event: DragStartEvent) {
    setActive(findTicket(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActive(null);
    const ticket = findTicket(event.active.id);
    const to = event.over?.id as TicketState | undefined;
    if (ticket && to && to !== ticket.state) onMove(ticket, to);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{ announcements }}
    >
      <div className="board">
        {TICKET_STATES.map((state) => (
          <Column
            key={state}
            state={state}
            tickets={columns[state]}
            total={totals[state]}
            savingIds={savingIds}
            activeId={active?.id ?? null}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>{active ? <CardBody ticket={active} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({
  state,
  tickets,
  total,
  savingIds,
  activeId,
  onOpen,
}: {
  state: TicketState;
  tickets: TicketSummary[];
  total: number;
  savingIds: ReadonlySet<string>;
  activeId: string | null;
  onOpen: (ticket: TicketSummary) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: state });
  const filteredOut = total - tickets.length;

  return (
    <section ref={setNodeRef} className={`column${isOver ? " over" : ""}`} aria-label={STATE_LABELS[state]}>
      <header className="column-header">
        <h2>{STATE_LABELS[state]}</h2>
        <span className="count" title={filteredOut > 0 ? `${filteredOut} hidden by filters` : undefined}>
          {filteredOut > 0 ? `${tickets.length} / ${total}` : total}
        </span>
      </header>
      <div className="column-cards">
        {tickets.map((t) => (
          <Card key={t.id} ticket={t} saving={savingIds.has(t.id)} dragging={t.id === activeId} onOpen={onOpen} />
        ))}
        {tickets.length === 0 && <p className="column-empty">{total > 0 ? "No matching tickets" : "No tickets"}</p>}
      </div>
    </section>
  );
}

const Card = memo(function Card({
  ticket,
  saving,
  dragging,
  onOpen,
}: {
  ticket: TicketSummary;
  saving: boolean;
  dragging: boolean;
  onOpen: (ticket: TicketSummary) => void;
}) {
  const { setNodeRef, attributes, listeners } = useDraggable({ id: ticket.id, disabled: saving });

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    listeners?.onKeyDown?.(e);
    // While this card is being dragged, Enter means "drop" (handled by the keyboard sensor), not "open".
    if (e.key === "Enter" && !e.defaultPrevented && !dragging) onOpen(ticket);
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={() => onOpen(ticket)}
      aria-label={`${ticket.title}, ${TYPE_LABELS[ticket.type]}${ticket.epicTitle ? `, epic ${ticket.epicTitle}` : ""}. Press Enter to open, Space to move.`}
      aria-busy={saving}
      className={`card-ticket${dragging ? " dragging" : ""}${saving ? " saving" : ""}`}
    >
      <CardBody ticket={ticket} />
    </div>
  );
});

function CardBody({ ticket, overlay }: { ticket: TicketSummary; overlay?: boolean }) {
  const content = (
    <>
      <div className="card-title">{ticket.title}</div>
      <div className="card-meta">
        <span className={`badge type-${ticket.type}`}>{TYPE_LABELS[ticket.type]}</span>
        {ticket.epicTitle && (
          <span className="card-epic" title={ticket.epicTitle}>
            {ticket.epicTitle}
          </span>
        )}
      </div>
    </>
  );
  return overlay ? <div className="card-ticket overlay">{content}</div> : content;
}
