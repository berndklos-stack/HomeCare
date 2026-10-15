"use client";
import { useState, type HTMLAttributes, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { DndContext, KeyboardSensor, MeasuringStrategy, MouseSensor, TouchSensor, closestCorners, pointerWithin, useSensor, useSensors, type Active, type CollisionDetection } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { orderedIds } from '@/lib/layoutPreferences';
import type { LayoutPreferencesController } from '@/lib/useLayoutPreferences';

type Language = 'de' | 'sv' | 'en';
const word = (language: Language, de: string, sv: string, en: string) => language === 'de' ? de : language === 'sv' ? sv : en;
const collision: CollisionDetection = (args) => {
  if (args.pointerCoordinates) return pointerWithin(args);
  const origin = args.droppableRects.get(args.active.id);
  const moved = origin && (Math.abs(origin.left - args.collisionRect.left) > 1 || Math.abs(origin.top - args.collisionRect.top) > 1);
  // A tall keyboard-dragged block can still overlap its original slot after
  // moving to a short neighbour. Do not let that slot mask the new target.
  return closestCorners({ ...args, droppableContainers: moved ? args.droppableContainers.filter(item => item.id !== args.active.id) : args.droppableContainers });
};
export function SortableOrder({ ids, disabled, change, language, children, activate, cancel }: { ids: string[]; disabled: boolean; change: (ids: string[]) => void; language: Language; children: ReactNode; activate: () => void; cancel: () => void }) {
  const options = { activationConstraint: { delay: 500, tolerance: 8 } };
  const sensors = useSensors(useSensor(MouseSensor, options), useSensor(TouchSensor, options), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, scrollBehavior: 'auto' }));
  const name = (item: Active) => String(item.data.current?.label ?? item.id);
  return <DndContext sensors={sensors} collisionDetection={collision} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} accessibility={{
    screenReaderInstructions: { draggable: word(language, 'Leertaste zum Aufnehmen. Pfeiltasten zum Verschieben. Leertaste zum Ablegen, Escape zum Abbrechen.', 'Tryck blanksteg, flytta med piltangenterna och släpp med blanksteg. Escape avbryter.', 'Press Space to pick up, arrow keys to move, Space to drop, Escape to cancel.') },
    announcements: {
      onDragStart: ({ active }) => word(language, `${name(active)} aufgenommen.`, `${name(active)} vald.`, `${name(active)} picked up.`),
      onDragOver: ({ over }) => over ? word(language, `Position ${ids.indexOf(String(over.id)) + 1} von ${ids.length}.`, `Position ${ids.indexOf(String(over.id)) + 1} av ${ids.length}.`, `Position ${ids.indexOf(String(over.id)) + 1} of ${ids.length}.`) : undefined,
      onDragEnd: () => word(language, 'Verschieben beendet.', 'Flytt avslutad.', 'Move ended.'),
      onDragCancel: () => word(language, 'Verschieben abgebrochen.', 'Flytt avbruten.', 'Move cancelled.'),
    },
  }} onDragStart={activate} onDragCancel={cancel} onDragEnd={({ active, over }) => {
    cancel();
    if (disabled || !over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id)), to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) change(arrayMove(ids, from, to));
  }}><SortableContext items={ids} strategy={rectSortingStrategy}>{children}</SortableContext></DndContext>;
}
export type LongPressBindings = Pick<HTMLAttributes<HTMLElement>, 'onMouseDown' | 'onTouchStart' | 'onContextMenu'>;
export function SortableRow({ id, label, language, disabled, className, children, nav = false }: { id: string; label: string; language: Language; disabled: boolean; className: string; children: (controls: { handle: ReactNode; press: LongPressBindings }) => ReactNode; nav?: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver } = useSortable({ id, disabled, data: { label } });
  const title = word(language, `${label} ziehen und verschieben`, `${label} dra och flytta`, `${label} drag to reorder`);
  const handle = <button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button" className="personal-drag-handle" disabled={disabled} title={title} aria-label={title} data-label={label}/>;
  const press: LongPressBindings = { onMouseDown: (event) => listeners?.onMouseDown?.(event), onTouchStart: (event) => listeners?.onTouchStart?.(event), onContextMenu: (event) => { if (!disabled) event.preventDefault(); } };
  return <div ref={setNodeRef} data-sort-id={id} data-nav-id={nav ? id : undefined} data-block-id={nav ? undefined : id} className={`${className}${isDragging ? ' personal-dragging' : isOver ? ' personal-drop-target' : ''}`} style={{ transform: CSS.Translate.toString(transform), transition, position: 'relative', zIndex: isDragging ? 2 : undefined }}>{children({ handle, press })}</div>;
}
export function OrderToolbar({ controller, language }: { controller: Pick<LayoutPreferencesController, 'ready' | 'saving' | 'error' | 'retry'>; language: Language }) {
  if (!controller.error && !controller.saving) return null;
  return <div className="personal-order-toolbar" aria-busy={controller.saving}>
    {controller.error && <button className="ghost-button" type="button" onClick={controller.retry}>{word(language, 'Einstellungen erneut laden', 'Ladda inställningar igen', 'Reload preferences')}</button>}
    <span role="status">{controller.saving ? word(language, 'Speichert…', 'Sparar…', 'Saving…') : word(language, 'Nicht gespeichert', 'Inte sparat', 'Not saved')}</span>
  </div>;
}
export function PersonalNavigation({ items, selected, select, controller, language }: { items: { id: string; label: string; icon: ReactNode }[]; selected: string; select: (id: string) => void; controller: LayoutPreferencesController; language: Language }) {
  const [arranging, setArranging] = useState(false);
  const ids = orderedIds(controller.preferences.navigationOrder, items.map((item) => item.id));
  return <div className={`personal-navigation${arranging ? ' personal-arranging' : ''}`} onKeyDownCapture={(event) => { if (arranging && event.key === 'Escape') { event.preventDefault(); setArranging(false); } }}>
    <OrderToolbar controller={controller} language={language}/>
    <SortableOrder ids={ids} disabled={!controller.ready || controller.saving} language={language} activate={() => setArranging(true)} cancel={() => setArranging(false)} change={(value) => void controller.save('navigationOrder', value)}><nav aria-label={word(language, 'Hauptnavigation', 'Huvudnavigation', 'Main navigation')}>{ids.map((id) => {
      const item = items.find((entry) => entry.id === id)!;
      return <SortableRow className="personal-nav-entry" key={id} id={id} label={item.label} language={language} nav disabled={!controller.ready || controller.saving}>{({ handle, press }) => <>
        <button {...press} type="button" className={selected === id ? 'nav-link active' : 'nav-link'} data-testid={`nav-${id}`} onClick={() => { if (!arranging) select(id); }}>{item.icon}{item.label}</button>
        {handle}
      </>}</SortableRow>;
    })}</nav></SortableOrder>
  </div>;
}
export function PersonalVehicleBlocks({ blocks, controller, language, locked = false }: { blocks: { id: string; title: string; count: number; content: ReactNode }[]; controller: LayoutPreferencesController; language: Language; locked?: boolean }) {
  const [open, setOpen] = useState<string[]>([]);
  const [arranging, setArranging] = useState(false);
  const ids = orderedIds(controller.preferences.vehicleBlockOrder, blocks.map((block) => block.id));
  return <div className={`wide personal-vehicle-blocks${arranging ? ' personal-arranging' : ''}`} onKeyDownCapture={(event) => { if (arranging && event.key === 'Escape') { event.preventDefault(); setArranging(false); } }}>
    <OrderToolbar controller={controller} language={language}/>
    <SortableOrder ids={ids} disabled={locked || !controller.ready || controller.saving} language={language} activate={() => setArranging(true)} cancel={() => setArranging(false)} change={(value) => void controller.save('vehicleBlockOrder', value)}>{ids.map((id) => {
      const block = blocks.find((item) => item.id === id)!;
      const expanded = open.includes(id);
      return <SortableRow className="personal-vehicle-block" id={id} key={id} label={block.title} language={language} disabled={locked || !controller.ready || controller.saving}>{({ handle, press }) => <>
        <div className="personal-vehicle-heading"><button {...press} className="vehicle-disclosure" type="button" aria-expanded={expanded} aria-controls={`vehicle-block-${id}`} disabled={locked && id === 'standardTrips'} onClick={() => { if (!arranging) setOpen((current) => expanded ? current.filter((item) => item !== id) : [...current, id]); }}><ChevronRight size={18} className={expanded ? 'expanded' : ''}/><span>{block.title}</span><small>{block.count}</small></button>
          {handle}
        </div>
        <div className="vehicle-block-content" id={`vehicle-block-${id}`} hidden={!expanded}>{block.content}</div>
      </>}</SortableRow>;
    })}</SortableOrder>
  </div>;
}
