"use client"

import { useState } from "react"
import Image from "next/image"

interface GalleryProps {
  images: { primary: string; hover?: string }
  alt: string
}

export default function Gallery({ images, alt }: GalleryProps) {
  // A hover cover that points at the same file as the primary is a duplicate,
  // not a second view. De-duplicate so the gallery never shows the same
  // artwork twice.
  const allImages = Array.from(
    new Set([images.primary, images.hover].filter((value): value is string => Boolean(value))),
  )
  const [active, setActive] = useState(0)

  return (
    <div className="book-detail-gallery">
      <Image
        src={allImages[active]}
        alt={alt}
        className="book-detail-main-image"
        width={900}
        height={1350}
        priority
        sizes="(max-width: 900px) 90vw, 420px"
      />
      {allImages.length > 1 && (
        <div className="book-detail-thumbs">
          {allImages.map((img, i) => (
            <button
              key={img}
              onClick={() => setActive(i)}
              className={`book-detail-thumb ${i === active ? "active" : ""}`}
              aria-label={`ছবি ${i + 1}`}
            >
              <Image
                src={img}
                alt=""
                width={120}
                height={160}
                sizes="60px"
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "var(--radius-md)" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
