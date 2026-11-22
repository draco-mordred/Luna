import { useEffect, type RefObject } from 'react';
import {
  createArtworkImageSampler,
  getArtworkPaletteButtonColors,
  type ArtworkImageSampler,
} from '../utils/imageColors';

const buttonSectionSelectors = [
  '.now-playing-header',
  '.expanded-controls',
  '.volume-control',
  '.track-title-menu-wrap',
  '.lyrics-actions',
  '.lyrics-panel-actions',
  '.player-mode-dock-controls',
  '.player-mode-exit',
  '.mini-player-control-cluster',
  '.mini-player-actions',
  '.mini-player .mini-progress-container',
  '.streaming-play-bar-track-heading',
  '.streaming-play-bar-transport',
  '.streaming-player-mode-controls',
  '.streaming-player-mode-exit',
];
const iconOnlySectionSelectors = ['.np-android-bottom-actions'];

const shouldAdaptTarget = (element: HTMLButtonElement) =>
  !element.matches('.track-menu-item, .track-menu-playlist-item, .audio-output-selector-option') &&
  !element.closest('.track-menu-popover, .audio-output-selector-menu, .more-options-menu');

export const useArtworkContrastTargets = <T extends HTMLElement>(
  rootRef: RefObject<T>,
  imageUrl: string | null
) => {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !imageUrl) return undefined;

    let active = true;
    let sampler: ArtworkImageSampler | null = null;
    const styledTargets = new Set<HTMLButtonElement>();
    const backgroundTargets = new Set<HTMLButtonElement>();

    const clearTarget = (element: HTMLButtonElement) => {
      element.style.removeProperty('--artwork-palette-dark-background');
      element.style.removeProperty('--artwork-palette-dark-foreground');
      element.style.removeProperty('--artwork-palette-dark-icon-color');
      element.style.removeProperty('--artwork-palette-light-background');
      element.style.removeProperty('--artwork-palette-light-foreground');
      element.style.removeProperty('--artwork-palette-light-icon-color');
      element.removeAttribute('data-artwork-palette-target');
      element.removeAttribute('data-artwork-palette-icon-target');
      styledTargets.delete(element);
      backgroundTargets.delete(element);
    };

    const applyPalette = () => {
      const activeSampler = sampler;
      if (!active || !activeSampler) return;

      const darkThemeColors = getArtworkPaletteButtonColors(activeSampler.palette, true);
      const lightThemeColors = getArtworkPaletteButtonColors(activeSampler.palette, false);

      const styleButtons = (selectors: string[], includeBackground: boolean) => {
        selectors.forEach((selector) => {
          root.querySelectorAll<HTMLElement>(selector).forEach((section) => {
            const buttons = section.matches('button')
              ? [section as HTMLButtonElement]
              : Array.from(section.querySelectorAll<HTMLButtonElement>('button'));

            buttons.forEach((button) => {
              if (!shouldAdaptTarget(button)) return;
              if (!styledTargets.has(button)) {
                button.setAttribute('data-artwork-palette-icon-target', 'true');
                button.style.setProperty(
                  '--artwork-palette-dark-icon-color',
                  darkThemeColors.iconColor
                );
                button.style.setProperty(
                  '--artwork-palette-light-icon-color',
                  lightThemeColors.iconColor
                );
                styledTargets.add(button);
              }
              if (!includeBackground || backgroundTargets.has(button)) return;

              button.setAttribute('data-artwork-palette-target', 'true');
              button.style.setProperty(
                '--artwork-palette-dark-background',
                darkThemeColors.background
              );
              button.style.setProperty(
                '--artwork-palette-dark-foreground',
                darkThemeColors.foreground
              );
              button.style.setProperty(
                '--artwork-palette-light-background',
                lightThemeColors.background
              );
              button.style.setProperty(
                '--artwork-palette-light-foreground',
                lightThemeColors.foreground
              );
              backgroundTargets.add(button);
            });
          });
        });
      };

      styleButtons(buttonSectionSelectors, true);
      styleButtons(iconOnlySectionSelectors, false);
    };

    const mutationObserver = new MutationObserver(applyPalette);
    mutationObserver.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
    });

    void createArtworkImageSampler(imageUrl).then((nextSampler) => {
      if (!active) return;
      sampler = nextSampler;
      applyPalette();
    });

    return () => {
      active = false;
      mutationObserver.disconnect();
      styledTargets.forEach(clearTarget);
    };
  }, [imageUrl, rootRef]);
};
