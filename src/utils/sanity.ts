import { createImageUrlBuilder } from '@sanity/image-url';
import { sanityClient } from 'sanity:client';
import type { Image } from 'sanity';

const builder = createImageUrlBuilder(sanityClient);

export function urlFor(source: Image) {
  return builder.image(source);
}
