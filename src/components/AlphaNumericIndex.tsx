import { useEffect, useRef, useState } from 'react';
import './AlphaNumericIndex.css';

export interface AlphaNumericIndexEntry {
  label: string;
  targetId: string;
}

const getScrollportContentTop = (scrollContainer: HTMLElement): number => {
  const paddingTop = Number.parseFloat(window.getComputedStyle(scrollContainer).paddingTop) || 0;
  return (
    scrollContainer.getBoundingClientRect().top +
    scrollContainer.clientTop +
    paddingTop
  );
};

export const getAlphaNumericLabel = (value: string | number | undefined) => {
  const firstCharacter = Array.from(String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, ''))[0] ?? '';
  if (/^[\p{L}\p{N}]$/u.test(firstCharacter)) return firstCharacter.toLocaleUpperCase();
  return /^\p{S}$/u.test(firstCharacter) ? '#' : '…';
};

export const buildAlphaNumericIndex = <T,>(
  items: T[],
  getValue: (item: T) => string | number | undefined,
  getTargetId: (item: T, index: number) => string
): AlphaNumericIndexEntry[] => {
  const seenLabels = new Set<string>();
  return items.reduce<AlphaNumericIndexEntry[]>((entries, item, index) => {
    const label = getAlphaNumericLabel(getValue(item));
    if (!seenLabels.has(label)) {
      seenLabels.add(label);
      entries.push({ label, targetId: getTargetId(item, index) });
    }
    return entries;
  }, []);
};

interface AlphaNumericIndexProps {
  entries: AlphaNumericIndexEntry[];
  ariaLabel: string;
  scrollContainerSelector: string;
}

const AlphaNumericIndex = ({
  entries,
  ariaLabel,
  scrollContainerSelector,
}: AlphaNumericIndexProps) => {
  const railRef = useRef<HTMLElement>(null);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (entries.length === 0) return undefined;

    let animationFrame = 0;
    const updateActiveEntry = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const scrollContainer = document.querySelector<HTMLElement>(scrollContainerSelector);
        const containerTop = scrollContainer ? getScrollportContentTop(scrollContainer) : 0;
        let activeEntry = entries[0];

        for (const entry of entries) {
          const target = document.getElementById(entry.targetId);
          if (target && target.getBoundingClientRect().top <= containerTop) {
            activeEntry = entry;
          } else {
            break;
          }
        }
        setActiveTargetId(activeEntry.targetId);
      });
    };

    updateActiveEntry();
    document.addEventListener('scroll', updateActiveEntry, true);
    window.addEventListener('resize', updateActiveEntry);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('scroll', updateActiveEntry, true);
      window.removeEventListener('resize', updateActiveEntry);
    };
  }, [entries, scrollContainerSelector]);

  const scrollToEntry = (entry: AlphaNumericIndexEntry) => {
    const target = document.getElementById(entry.targetId);
    const scrollContainer = document.querySelector<HTMLElement>(scrollContainerSelector);
    if (!target || !scrollContainer) return;

    const scrollportTop = getScrollportContentTop(scrollContainer);
    scrollContainer.scrollTo({
      top:
        scrollContainer.scrollTop +
        target.getBoundingClientRect().top -
        scrollportTop,
      behavior: 'auto',
    });
  };

  const scrollToPointerPosition = (clientY: number) => {
    const rail = railRef.current;
    if (!rail || entries.length === 0) return;
    const { top, height } = rail.getBoundingClientRect();
    const index = Math.max(
      0,
      Math.min(entries.length - 1, Math.floor(((clientY - top) / height) * entries.length))
    );
    scrollToEntry(entries[index]);
  };

  if (entries.length === 0) return null;

  return (
    <nav
      className='alpha-numeric-index'
      aria-label={ariaLabel}
      ref={railRef}
      style={{ height: `min(88vh, ${Math.max(120, Math.min(entries.length * 18, 620))}px)` }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        scrollToPointerPosition(event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 1) scrollToPointerPosition(event.clientY);
      }}
    >
      {entries.map((entry) => (
        <button
          key={`${entry.label}-${entry.targetId}`}
          className={`alpha-numeric-index-button ${activeTargetId === entry.targetId ? 'active' : ''}`}
          type='button'
          aria-label={`Jump to ${entry.label}${entry.label === '#' ? ' symbols' : entry.label === '…' ? ' other characters' : ''}`}
          aria-current={activeTargetId === entry.targetId ? 'location' : undefined}
          onClick={() => scrollToEntry(entry)}
        >
          {entry.label}
        </button>
      ))}
    </nav>
  );
};

export default AlphaNumericIndex;
