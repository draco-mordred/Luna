import { useEffect, useId, useRef, useState } from 'react';

export interface AndroidLibrarySortOption<T extends string> {
  value: T;
  label: string;
}

interface AndroidLibrarySortMenuProps<T extends string> {
  options: ReadonlyArray<AndroidLibrarySortOption<T>>;
  sortBy: T;
  onSortByChange: (value: T) => void;
  sortDirection: 'asc' | 'desc';
  onToggleDirection: () => void;
}

const AndroidLibrarySortMenu = <T extends string>({
  options,
  sortBy,
  onSortByChange,
  sortDirection,
  onToggleDirection,
}: AndroidLibrarySortMenuProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const selectedOption = options.find((option) => option.value === sortBy);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className='android-library-sort' ref={containerRef}>
      <button
        ref={triggerRef}
        className='android-library-sort-trigger'
        type='button'
        aria-label={`Sort by ${selectedOption?.label ?? 'name'}`}
        aria-haspopup='true'
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className='material-symbols-outlined' aria-hidden='true'>
          sort
        </span>
        <span>{selectedOption?.label ?? 'Sort'}</span>
        <span className='material-symbols-outlined android-library-sort-chevron' aria-hidden='true'>
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {isOpen && (
        <div
          className='android-library-sort-menu'
          id={menuId}
          role='group'
          aria-label='Sort options'
        >
          {options.map((option) => (
            <button
              key={option.value}
              className='android-library-sort-option'
              type='button'
              aria-pressed={option.value === sortBy}
              onClick={() => {
                onSortByChange(option.value);
                setIsOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <span>{option.label}</span>
              {option.value === sortBy && (
                <span className='material-symbols-outlined' aria-hidden='true'>
                  check
                </span>
              )}
            </button>
          ))}
          <button
            className='android-library-sort-direction'
            type='button'
            aria-label={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'}; toggle direction`}
            onClick={onToggleDirection}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
            </span>
            <span>{sortDirection === 'asc' ? 'Ascending' : 'Descending'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AndroidLibrarySortMenu;
