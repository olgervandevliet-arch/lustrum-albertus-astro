import imageUrlBuilder from '@sanity/image-url';
import { sanityClient } from 'sanity:client';
import type { Image } from 'sanity';

const builder = imageUrlBuilder(sanityClient);

export function urlFor(source: Image) {
  return builder.image(source);
}
