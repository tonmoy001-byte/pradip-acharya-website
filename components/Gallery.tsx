"use client"

import { useState } from "react"

interface GalleryProps {
  images: { primary: string; hover?: string }
  alt: string
}

export default function Gallery({ images, alt }: GalleryProps) {
  const allImages = [images.primary, images.hover].filter(Boolean) as string[]
  const [active, setActive] = useState(0)

  return (
    <div className="book-detail-gallery">
      <img
        src={allImages[active]}
        alt={alt}
        className="book-detail-main-image"
      />
      {allImages.length > 1 && (
        <div className="book-detail-thumbs">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`book-detail-thumb ${i === active ? "active" : ""}`}
              aria-label={`ছবি ${i + 1}`}
            >
              <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "var(--radius-md)" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
