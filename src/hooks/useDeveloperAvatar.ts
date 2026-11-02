import { useEffect, useState } from 'react';
import { DEVELOPER_AVATAR_KEY } from '../constants/developer';

let developerAvatarRequest: Promise<string | null> | null = null;

const fetchAndCacheDeveloperAvatar = () => {
  if (developerAvatarRequest) return developerAvatarRequest;
  developerAvatarRequest = (async () => {
    try {
      const profileResponse = await fetch('https://api.github.com/users/draco-mordred', {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!profileResponse.ok) {
        throw new Error(`GitHub profile request failed (${profileResponse.status}).`);
      }
      const profile = (await profileResponse.json()) as { avatar_url?: string };
      if (!profile.avatar_url) throw new Error('The GitHub profile did not provide an avatar.');

      const avatarResponse = await fetch(`${profile.avatar_url}&size=128`);
      if (!avatarResponse.ok) {
        throw new Error(`GitHub avatar request failed (${avatarResponse.status}).`);
      }
      const image = await createImageBitmap(await avatarResponse.blob());
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 96;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not prepare the developer avatar for local storage.');
        context.drawImage(image, 0, 0, 96, 96);
        const dataUrl = canvas.toDataURL('image/webp', 0.82);
        window.localStorage.setItem(DEVELOPER_AVATAR_KEY, dataUrl);
        return dataUrl;
      } finally {
        image.close();
      }
    } catch (error) {
      console.warn('Could not refresh the cached developer avatar:', error);
      return null;
    } finally {
      developerAvatarRequest = null;
    }
  })();
  return developerAvatarRequest;
};

export const useDeveloperAvatar = () => {
  const [avatar, setAvatar] = useState(() => window.localStorage.getItem(DEVELOPER_AVATAR_KEY) ?? '');

  useEffect(() => {
    let active = true;
    void fetchAndCacheDeveloperAvatar().then((cachedAvatar) => {
      if (active && cachedAvatar) setAvatar(cachedAvatar);
    });
    return () => {
      active = false;
    };
  }, []);

  return avatar;
};
