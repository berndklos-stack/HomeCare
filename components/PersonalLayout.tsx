"use client";
import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, GripVertical, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useSensor, useSensors, type CollisionDetection } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { moveLayoutItem, navigationOrder, orderedIds, vehicleBlockOrder } from '@/lib/layoutPreferences';
import type { LayoutPreferencesController } from '@/lib/useLayoutPreferences';

type Language = 'de' | 'sv' | 'en';
const word = (language: Language, de: string, sv: string, en: string) => language === 'de' ? de : language === 'sv' ? sv : en;
const collision: CollisionDetection = (args) => args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);
function SortableOrder({ ids, disabled, change, language, children }: { ids: string[]; disabled: boolean; change: (ids: string[]) => void; language: Language; children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const name = (id: string | number) => typeof document === 'undefined' ? String(id) : document.querySelector<HTMLElement>(`[data-sort-id="${id}"] .personal-drag-handle`)?.dataset.label ?? String(id);
  return <DndContext sensors={sensors} collisionDetection={collision} accessibility={{
    screenReaderInstructions: { draggable: word(language, 'Leertaste zum Aufnehmen. Pfeiltasten zum Verschieben. Leertaste zum Ablegen, Escape zum Abbrechen.', 'Tryck blanksteg, flytta med piltangenterna och släpp med blanksteg. Escape avbryter.', 'Press Space to pick up, arrow keys to move, Space to drop, Escape to cancel.') },
    announcements: {
      onDragStart: ({ active }) => word(language, `${name(active.id)} aufgenommen.`, `${name(active.id)} vald.`, `${name(active.id)} picked up.`),
      onDragOver: ({ over }) => over ? word(language, `Position ${ids.indexOf(String(over.id)) + 1} von ${ids.length}.`, `Position ${ids.indexOf(String(over.id)) + 1} av ${ids.length}.`, `Position ${ids.indexOf(String(over.id)) + 1} of ${ids.length}.`) : undefined,
      onDragEnd: () => word(language, 'Verschieben beendet.', 'Flytt avslutad.', 'Move ended.'),
      onDragCancel: () => word(language, 'Verschieben abgebrochen.', 'Flytt avbruten.', 'Move cancelled.'),
    },
  }} onDragEnd={({ active, over }) => {
    if (disabled || !over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id)), to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) change(arrayMove(ids, from, to));
  }}><SortableContext items={ids} strategy={rectSortingStrategy}>{children}</SortableContext></DndContext>;
}
function SortableRow({ id, label, language, disabled, className, children, nav = false }: { id: string; label: string; language: Language; disabled: boolean; className: string; children: (handle: ReactNode) => ReactNode; nav?: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const title = word(language, `${label} ziehen und verschieben`, `${label} dra och flytta`, `${label} drag to reorder`);
  const handle = <button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button" className="icon-button personal-drag-handle" disabled={disabled} title={title} aria-label={title} data-label={label}><GripVertical size={18}/></button>;
  return <div ref={setNodeRef} data-sort-id={id} data-nav-id={nav ? id : undefined} data-block-id={nav ? undefined : id} className={`${className}${isDragging ? ' personal-dragging' : ''}`} style={{ transform: CSS.Translate.toString(transform), transition, position: 'relative', zIndex: isDragging ? 2 : undefined }}>{children(handle)}</div>;
}
function OrderArrows({ ids, id, label, language, disabled, change }: { ids: string[]; id: string; label: string; language: Language; disabled: boolean; change: (ids: string[]) => void }) {
  const index = ids.indexOf(id);
  return <div className="personal-order-arrows">{([-1, 1] as const).map((direction) => {
    const title = label + ' ' + word(language, direction === -1 ? 'nach oben verschieben' : 'nach unten verschieben', direction === -1 ? 'flytta upp' : 'flytta ned', direction === -1 ? 'move up' : 'move down');
    const Icon = direction === -1 ? ArrowUp : ArrowDown;
    return <button key={direction} type="button" className="icon-button" title={title} aria-label={title} disabled={disabled || (direction === -1 ? index === 0 : index === ids.length - 1)} onClick={() => change(moveLayoutItem(ids, id, direction))}><Icon size={16}/></button>;
  })}</div>;
}
function OrderToolbar({ controller, language, active, toggle, reset, locked = false }: { controller: LayoutPreferencesController; language: Language; active: boolean; toggle: () => void; reset: () => void; locked?: boolean }) {
  const title = word(language, active ? 'Anordnen beenden' : 'Anordnen', active ? 'Klar' : 'Ordna', active ? 'Done arranging' : 'Arrange');
  return <div className="personal-order-toolbar">
    <button className="ghost-button" type="button" title={title} aria-pressed={active} onClick={toggle}>{active ? <Check size={16}/> : <SlidersHorizontal size={16}/>} {title}</button>
    {active && <button className="icon-button" type="button" title={word(language, 'Standardreihenfolge', 'Standardordning', 'Default order')} aria-label={word(language, 'Standardreihenfolge', 'Standardordning', 'Default order')} disabled={locked || !controller.ready || controller.saving} onClick={reset}><RotateCcw size={16}/></button>}
    {controller.error && active && <button className="ghost-button" type="button" onClick={controller.retry}>{word(language, 'Einstellungen erneut laden', 'Ladda inställningar igen', 'Reload preferences')}</button>}
    {active && <span role="status">{controller.saving ? word(language, 'Speichert…', 'Sparar…', 'Saving…') : controller.error ? word(language, 'Nicht gespeichert', 'Inte sparat', 'Not saved') : ''}</span>}
  </div>;
}
export function PersonalNavigation({ items, selected, select, controller, language }: { items: { id: string; label: string; icon: ReactNode }[]; selected: string; select: (id: string) => void; controller: LayoutPreferencesController; language: Language }) {
  const [arranging, setArranging] = useState(false);
  const ids = orderedIds(controller.preferences.navigationOrder, items.map((item) => item.id));
  return <div className="personal-navigation">
    <OrderToolbar controller={controller} language={language} active={arranging} toggle={() => setArranging((value) => !value)} reset={() => void controller.save('navigationOrder', [...navigationOrder])}/>
    <SortableOrder ids={ids} disabled={!arranging || !controller.ready || controller.saving} language={language} change={(value) => void controller.save('navigationOrder', value)}><nav aria-label={word(language, 'Hauptnavigation', 'Huvudnavigation', 'Main navigation')}>{ids.map((id) => {
      const item = items.find((entry) => entry.id === id)!;
      return <SortableRow className="personal-nav-entry" key={id} id={id} label={item.label} language={language} nav disabled={!arranging || !controller.ready || controller.saving}>{(handle) => <>
        <button type="button" className={selected === id ? 'nav-link active' : 'nav-link'} data-testid={`nav-${id}`} onClick={() => select(id)}>{item.icon}{item.label}</button>
        {arranging && <>{handle}<OrderArrows ids={ids} id={id} label={item.label} language={language} disabled={!controller.ready || controller.saving} change={(value) => void controller.save('navigationOrder', value)}/></>}
      </>}</SortableRow>;
    })}</nav></SortableOrder>
  </div>;
}
export function PersonalVehicleBlocks({ blocks, controller, language, locked = false }: { blocks: { id: string; title: string; count: number; content: ReactNode }[]; controller: LayoutPreferencesController; language: Language; locked?: boolean }) {
  const [open, setOpen] = useState<string[]>([]);
  const [arranging, setArranging] = useState(false);
  const ids = orderedIds(controller.preferences.vehicleBlockOrder, blocks.map((block) => block.id));
  return <div className="wide personal-vehicle-blocks">
    <OrderToolbar controller={controller} language={language} active={arranging} locked={locked} toggle={() => setArranging((value) => !value)} reset={() => void controller.save('vehicleBlockOrder', [...vehicleBlockOrder])}/>
    <SortableOrder ids={ids} disabled={!arranging || locked || !controller.ready || controller.saving} language={language} change={(value) => void controller.save('vehicleBlockOrder', value)}>{ids.map((id) => {
      const block = blocks.find((item) => item.id === id)!;
      const expanded = open.includes(id);
      return <SortableRow className="personal-vehicle-block" id={id} key={id} label={block.title} language={language} disabled={!arranging || locked || !controller.ready || controller.saving}>{(handle) => <>
        <div className="personal-vehicle-heading"><button className="vehicle-disclosure" type="button" aria-expanded={expanded} aria-controls={`vehicle-block-${id}`} disabled={locked && id === 'standardTrips'} onClick={() => setOpen((current) => expanded ? current.filter((item) => item !== id) : [...current, id])}><ChevronRight size={18} className={expanded ? 'expanded' : ''}/><span>{block.title}</span><small>{block.count}</small></button>
          {arranging && <>{handle}<OrderArrows ids={ids} id={id} label={block.title} language={language} disabled={locked || !controller.ready || controller.saving} change={(value) => void controller.save('vehicleBlockOrder', value)}/></>}
        </div>
        <div className="vehicle-block-content" id={`vehicle-block-${id}`} hidden={!expanded}>{block.content}</div>
      </>}</SortableRow>;
    })}</SortableOrder>
  </div>;
}
