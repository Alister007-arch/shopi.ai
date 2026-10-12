import React, { useState } from 'react';
import { BRAND } from '../config/brand';

/**
 * Performant, accessible picture element for Trovi catalog.
 * Serves optimized WebP format with native fallback to original JPG.
 * Includes skeleton shimmer while loading, explicit dimensions to prevent CLS,
 * and graceful fallback handling.
 */
export default function ProductImage({
  src,
  alt = `${BRAND.name} product photo`,
  width = 300,
  height = 200,
  className = '',
  style = {},
  loading = 'lazy',
  objectFit = 'cover',
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Derive WebP path if given a .jpg product path
  const webpSrc = src && src.endsWith('.jpg')
    ? src.replace(/\.jpg$/, '.webp')
    : src;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--bg-card-muted)',
        borderRadius: 'inherit',
        ...style,
      }}
      className={`product-image-container ${className}`}
    >
      {/* Skeleton Shimmer Overlay while loading */}
      {!loaded && !error && (
        <div
          className="skeleton-shimmer"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
      )}

      {error ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            background: 'var(--bg-card-muted)',
            flexDirection: 'column',
            gap: 6,
            padding: 12,
            textAlign: 'center',
          }}
          aria-label={alt}
        >
          <span style={{ fontSize: '1.4rem' }}>🌿</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{alt}</span>
        </div>
      ) : (
        <picture style={{ width: '100%', height: '100%', display: 'block' }}>
          {webpSrc && <source srcSet={webpSrc} type="image/webp" />}
          <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            loading={loading}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: objectFit,
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.25s ease-in-out',
              display: 'block',
            }}
          />
        </picture>
      )}
    </div>
  );
}
