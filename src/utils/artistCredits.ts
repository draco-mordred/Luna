const ARTIST_CREDIT_SEPARATOR =
  /\s*(?:[,;&+/×]|\s+(?:feat(?:uring)?|ft|with|and|vs)\.?\s+|\s+x\s+)\s*/gi;

export const splitArtistCredits = (credit: string): string[] => {
  const artists = credit
    .split(ARTIST_CREDIT_SEPARATOR)
    .map((artist) => artist.trim())
    .filter(Boolean);
  return artists.filter(
    (artist, index) =>
      artists.findIndex((candidate) => candidate.toLocaleLowerCase() === artist.toLocaleLowerCase()) === index
  );
};

export const artistCreditIncludes = (credit: string, artist: string): boolean => {
  const normalizedArtist = artist.trim().toLocaleLowerCase();
  if (!normalizedArtist) return false;
  return splitArtistCredits(credit).some(
    (creditedArtist) => creditedArtist.toLocaleLowerCase() === normalizedArtist
  );
};
