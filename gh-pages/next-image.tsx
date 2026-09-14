/* eslint-disable next/no-img-element -- next/image is unavailable in the static build. */
import type { ImgHTMLAttributes } from 'react';

/** Static-build stand-in for next/image: the game only shows unoptimized SVGs. */
export default function Image({
  alt,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return <img alt={alt} {...props} />;
}
