"use client";

import { Children, Fragment, createContext, isValidElement, useContext, useState, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { mergeVisibleBlockOrder } from '@/lib/blockLayouts';
import { orderedIds } from '@/lib/layoutPreferences';
import type { BlockLayoutsController } from '@/lib/useBlockLayouts';
import { OrderArrows, OrderToolbar, SortableOrder, SortableRow } from './PersonalLayout';

type Language = 'de' | 'sv' | 'en';
const LayoutContext = createContext<BlockLayoutsController | null>(null);
export function PersonalBlocksProvider({ controller, children }: { controller: BlockLayoutsController; children: ReactNode }) {
  return <LayoutContext.Provider value={controller}>{children}</LayoutContext.Provider>;
}
type BlockProps = { id: string; title: string; children: ReactNode; className?: string; pressable?: boolean };
export function PersonalBlock({ children, className }: BlockProps) { return <div className={className}>{children}</div>; }

// Only neutral areas and headings initiate a move. Existing controls, tables
// and editable content retain their normal pointer and scrolling behaviour.
function canStart(event: { target: EventTarget | null }, pressable = false) {
  return event.target instanceof Element && !event.target.closest(`input,textarea,select,a,label,[contenteditable="true"],table,[role="grid"],.table-list,[data-no-reorder]${pressable ? '' : ',button,[role="button"]'}`);
}
function flatten(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap(node => isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment ? flatten(node.props.children) : [node]);
}
export function PersonalBlocks({ scope, language, children, className = 'stack', locked = false, ...attributes }: HTMLAttributes<HTMLDivElement> & { scope: string; language: Language; children: ReactNode; locked?: boolean }) {
  const controller = useContext(LayoutContext);
  const [arranging, setArranging] = useState(false);
  const nodes = flatten(children);
  const blocks = nodes.filter((node): node is ReactElement<BlockProps> => isValidElement<BlockProps>(node) && node.type === PersonalBlock);
  const visible = blocks.map(block => block.props.id);
  const ids = orderedIds(controller?.orders[scope], visible);
  const disabled = locked || ids.length < 2 || !controller?.ready || controller.saving;
  const change = (next: string[]) => {
    if (controller && !disabled) void controller.save(scope, mergeVisibleBlockOrder(controller.orders[scope], visible, next));
  };
  let slot = 0;
  return <div {...attributes} data-layout-scope={scope} className={`${className} personal-blocks${arranging ? ' personal-arranging' : ''}`} onKeyDownCapture={(event) => {
    if (arranging && event.key === 'Escape') { event.preventDefault(); setArranging(false); }
    attributes.onKeyDownCapture?.(event);
  }}>
    {controller && <OrderToolbar controller={controller} language={language} active={arranging} locked={locked} toggle={() => setArranging(false)} reset={() => change(visible)}/>}
    <SortableOrder ids={ids} disabled={disabled} language={language} activate={() => setArranging(true)} cancel={() => setArranging(false)} change={change}>
      {nodes.map(node => {
        if (!isValidElement<BlockProps>(node) || node.type !== PersonalBlock) return node;
        const id = ids[slot++];
        const block = blocks.find(item => item.props.id === id)!;
        return <SortableRow key={id} id={id} label={block.props.title} language={language} disabled={disabled} className={`personal-block-item ${block.props.className ?? ''}`}>{({ handle, press }) => <>
          <div className="personal-block-controls">{arranging && <span>{block.props.title}</span>}{handle}{arranging && <OrderArrows ids={ids} id={id} label={block.props.title} language={language} disabled={disabled} change={change}/>}</div>
          <div className="personal-block-content" onMouseDown={event => { if (canStart(event, block.props.pressable)) { event.stopPropagation(); press.onMouseDown?.(event); } }} onTouchStart={event => { if (canStart(event, block.props.pressable)) { event.stopPropagation(); press.onTouchStart?.(event); } }} onContextMenu={event => { if (canStart(event, block.props.pressable)) { event.stopPropagation(); press.onContextMenu?.(event); } }}>{block.props.children}</div>
        </>}</SortableRow>;
      })}
    </SortableOrder>
  </div>;
}
