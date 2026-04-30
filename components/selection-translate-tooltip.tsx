'use client';

import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { requestEnglishTranslation } from '@/lib/translation-client';
import {
  containsJapaneseText,
  MAX_TRANSLATION_TEXT_LENGTH,
  normalizeSelectionTextForTranslation,
} from '@/lib/translation';

type TooltipPlacement = 'above' | 'below';

type SelectionTooltipState = {
  range: Range;
  originalText: string;
  requestText: string;
  top: number;
  left: number;
  placement: TooltipPlacement;
};
const DISALLOWED_SELECTION_SELECTOR = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'option',
  'label',
  'summary',
  '[role="button"]',
  '[contenteditable="true"]',
  '[data-no-translate-selection]',
  '[data-selection-translate-tooltip]',
].join(', ');

function getElementFromNode(node: Node | null): HTMLElement | null {
  if (node instanceof HTMLElement) return node;
  return node?.parentElement ?? null;
}

function getNearestBlockContainer(node: Node | null): HTMLElement | null {
  let element = getElementFromNode(node);

  while (element && element !== document.body) {
    const display = window.getComputedStyle(element).display;
    if (
      display === 'block' ||
      display === 'flex' ||
      display === 'grid' ||
      display === 'table' ||
      display === 'table-cell' ||
      display === 'list-item' ||
      display === 'flow-root' ||
      ['P', 'DIV', 'TD', 'TH', 'LI', 'PRE', 'CODE', 'BLOCKQUOTE', 'DD', 'DT'].includes(element.tagName)
    ) {
      return element;
    }

    element = element.parentElement;
  }

  return element ?? null;
}

function getRangeRect(range: Range): DOMRect | null {
  const primaryRect = range.getBoundingClientRect();
  if (primaryRect.width > 0 || primaryRect.height > 0) return primaryRect;

  const fallbackRect = range.getClientRects()[0];
  return fallbackRect ?? null;
}

function buildTooltipState(selection: Selection | null): SelectionTooltipState | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const rawSelectionText = selection.toString();
  const requestText = normalizeSelectionTextForTranslation(rawSelectionText);
  if (!requestText || requestText.length > MAX_TRANSLATION_TEXT_LENGTH) return null;
  if (!containsJapaneseText(requestText)) return null;

  const range = selection.getRangeAt(0);
  const startElement = getElementFromNode(range.startContainer);
  const endElement = getElementFromNode(range.endContainer);
  if (!startElement || !endElement) return null;

  if (
    startElement.closest(DISALLOWED_SELECTION_SELECTOR) ||
    endElement.closest(DISALLOWED_SELECTION_SELECTOR)
  ) {
    return null;
  }

  const startBlock = getNearestBlockContainer(range.startContainer);
  const endBlock = getNearestBlockContainer(range.endContainer);
  if (!startBlock || !endBlock || startBlock !== endBlock) return null;

  const rect = getRangeRect(range);
  if (!rect) return null;

  const placement: TooltipPlacement = rect.top < 88 ? 'below' : 'above';
  const top = placement === 'below' ? rect.bottom + 10 : rect.top - 10;

  return {
    range: range.cloneRange(),
    originalText: rawSelectionText.trim(),
    requestText,
    top,
    left: rect.left + rect.width / 2,
    placement,
  };
}

function applyTranslationToRange(range: Range, originalText: string, translatedText: string) {
  const translatedNode = document.createElement('span');
  translatedNode.className = 'wf-inline-translation';
  translatedNode.lang = 'en';
  translatedNode.title = originalText;
  translatedNode.dataset.originalText = originalText;
  translatedNode.textContent = translatedText;

  range.deleteContents();
  range.insertNode(translatedNode);
}

export function SelectionTranslateTooltip() {
  const [tooltipState, setTooltipState] = useState<SelectionTooltipState | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const syncSelection = useEffectEvent(() => {
    setTooltipState(buildTooltipState(window.getSelection()));
  });

  const syncTooltipPosition = useEffectEvent(() => {
    setTooltipState((current) => {
      if (!current) return null;

      const rect = getRangeRect(current.range);
      if (!rect) return null;

      const placement: TooltipPlacement = rect.top < 88 ? 'below' : 'above';
      return {
        ...current,
        top: placement === 'below' ? rect.bottom + 10 : rect.top - 10,
        left: rect.left + rect.width / 2,
        placement,
      };
    });
  });

  useEffect(() => {
    let frame = 0;

    const handleSelectionChange = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        syncSelection();
      });
    };

    const handleViewportChange = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        syncTooltipPosition();
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, []);

  const handleTranslate = useCallback(async () => {
    if (!tooltipState || isTranslating) return;

    const activeTooltipState = tooltipState;
    setIsTranslating(true);

    try {
      const payload = await requestEnglishTranslation(activeTooltipState.requestText);

      applyTranslationToRange(
        activeTooltipState.range,
        activeTooltipState.originalText,
        payload.translatedText
      );
      window.getSelection()?.removeAllRanges();
      setTooltipState(null);
      toast.success('Translated selection to English.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Translation failed.';
      toast.error(message);
    } finally {
      setIsTranslating(false);
    }
  }, [isTranslating, tooltipState]);

  if (!tooltipState) return null;

  return (
    <div className='pointer-events-none fixed inset-0 z-[70]' data-no-translate-selection>
      <div
        data-selection-translate-tooltip
        className='pointer-events-auto absolute left-0 top-0'
        style={{
          left: tooltipState.left,
          top: tooltipState.top,
          transform:
            tooltipState.placement === 'below' ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
        }}
      >
        <div className='flex items-center gap-2 rounded-xl border border-border/70 bg-popover/95 p-2 text-popover-foreground shadow-xl backdrop-blur'>
          <Button
            type='button'
            size='sm'
            className='h-8 gap-1.5'
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void handleTranslate()}
            disabled={isTranslating}
          >
            {isTranslating ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Languages className='h-4 w-4' />
            )}
            Translate to English
          </Button>
        </div>
      </div>
    </div>
  );
}
