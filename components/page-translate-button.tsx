'use client';

import { useCallback, useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { requestEnglishTranslation } from '@/lib/translation-client';
import {
  containsJapaneseText,
  MAX_TRANSLATION_TEXT_LENGTH,
  normalizeSelectionTextForTranslation,
} from '@/lib/translation';

type PageTranslationTarget = {
  node: Text;
  originalText: string;
  requestText: string;
};

const PAGE_TRANSLATE_EXCLUDED_SELECTOR = [
  '[data-page-translation]',
  '[data-selection-translate-tooltip]',
  '[data-no-page-translate]',
  '[data-no-translate-selection]',
  '[hidden]',
  '[aria-hidden="true"]',
  '[contenteditable="true"]',
  'button',
  'code',
  'input',
  'kbd',
  'label',
  'noscript',
  'option',
  'pre',
  'samp',
  'script',
  'select',
  'style',
  'textarea',
  'template',
].join(', ');

function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return element.getClientRects().length > 0;
}

function findPageTranslationTargets(root: HTMLElement): PageTranslationTarget[] {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!(node instanceof Text)) return NodeFilter.FILTER_REJECT;

        const originalText = node.nodeValue ?? '';
        const requestText = normalizeSelectionTextForTranslation(originalText);
        if (!requestText || requestText.length > MAX_TRANSLATION_TEXT_LENGTH) {
          return NodeFilter.FILTER_REJECT;
        }

        if (!containsJapaneseText(requestText)) {
          return NodeFilter.FILTER_REJECT;
        }

        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest(PAGE_TRANSLATE_EXCLUDED_SELECTOR)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (!isElementVisible(parent)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const targets: PageTranslationTarget[] = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    const textNode = currentNode as Text;
    const originalText = textNode.nodeValue ?? '';
    const requestText = normalizeSelectionTextForTranslation(originalText);

    if (requestText && containsJapaneseText(requestText) && requestText.length <= MAX_TRANSLATION_TEXT_LENGTH) {
      targets.push({
        node: textNode,
        originalText,
        requestText,
      });
    }

    currentNode = walker.nextNode();
  }

  return targets;
}

function replaceTextNodeWithTranslation(
  node: Text,
  originalText: string,
  translatedText: string
): boolean {
  const parent = node.parentNode;
  if (!parent) return false;

  const leadingWhitespace = originalText.match(/^\s*/)?.[0] ?? '';
  const trailingWhitespace = originalText.match(/\s*$/)?.[0] ?? '';

  const translatedNode = document.createElement('span');
  translatedNode.className = 'wf-inline-translation';
  translatedNode.lang = 'en';
  translatedNode.title = originalText.trim();
  translatedNode.dataset.originalText = originalText.trim();
  translatedNode.dataset.pageTranslation = 'true';
  translatedNode.textContent = translatedText;

  const fragment = document.createDocumentFragment();
  if (leadingWhitespace) {
    fragment.append(document.createTextNode(leadingWhitespace));
  }
  fragment.append(translatedNode);
  if (trailingWhitespace) {
    fragment.append(document.createTextNode(trailingWhitespace));
  }

  parent.replaceChild(fragment, node);
  return true;
}

async function translateUniqueTexts(texts: string[]): Promise<{
  failedCount: number;
  translations: Map<string, string>;
}> {
  const queue = [...texts];
  const translations = new Map<string, string>();
  let failedCount = 0;

  const worker = async () => {
    while (queue.length > 0) {
      const nextText = queue.shift();
      if (!nextText) return;

      try {
        const result = await requestEnglishTranslation(nextText);
        translations.set(nextText, result.translatedText);
      } catch (error) {
        failedCount += 1;
        console.error('Failed to auto-translate page text:', error);
      }
    }
  };

  const concurrency = Math.min(4, texts.length);
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return { failedCount, translations };
}

export function PageTranslateButton() {
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslatePage = useCallback(async () => {
    if (isTranslating) return;

    const main = document.querySelector('main');
    const root = main instanceof HTMLElement ? main : document.body;
    if (!root) {
      toast.error('Could not find page content to translate.');
      return;
    }

    const targets = findPageTranslationTargets(root);
    if (targets.length === 0) {
      toast('No Japanese text found on this page.');
      return;
    }

    setIsTranslating(true);

    try {
      const uniqueTexts = [...new Set(targets.map((target) => target.requestText))];
      const { failedCount, translations } = await translateUniqueTexts(uniqueTexts);

      let translatedCount = 0;
      for (const target of targets) {
        const translatedText = translations.get(target.requestText);
        if (!translatedText) continue;

        if (replaceTextNodeWithTranslation(target.node, target.originalText, translatedText)) {
          translatedCount += 1;
        }
      }

      if (translatedCount === 0) {
        toast.error('Found Japanese text, but none of it could be translated.');
        return;
      }

      const failedSuffix = failedCount > 0 ? ` ${failedCount} section${failedCount === 1 ? '' : 's'} failed.` : '';
      toast.success(
        `Translated ${translatedCount} section${translatedCount === 1 ? '' : 's'} on this page.${failedSuffix}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to translate the page.';
      toast.error(message);
    } finally {
      setIsTranslating(false);
    }
  }, [isTranslating]);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => void handleTranslatePage()}
            className='h-9 w-9'
            aria-label='Translate visible Japanese text on this page'
            title='Translate page'
            disabled={isTranslating}
          >
            {isTranslating ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Languages className='h-4 w-4' />
            )}
            <span className='sr-only'>Translate page</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side='bottom'>Scan this page and translate Japanese text</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
