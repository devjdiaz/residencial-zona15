"use client"
import { useEffect } from "react"

export default function RevealInit() {
  useEffect(() => {
    const reveals = Array.from(document.querySelectorAll<HTMLElement>(".reveal"))

    const reveal = () => {
      const vh = window.innerHeight
      for (let i = reveals.length - 1; i >= 0; i--) {
        const el = reveals[i]
        const r = el.getBoundingClientRect()
        if (r.top < vh * 0.92 && r.bottom > 0) {
          el.classList.add("in")
          reveals.splice(i, 1)
        }
      }
    }

    requestAnimationFrame(() => {
      document.documentElement.classList.add("arm")
      reveal()
    })

    window.addEventListener("scroll", reveal, { passive: true })
    window.addEventListener("resize", reveal)
    const safety = setTimeout(
      () => reveals.slice().forEach((el) => el.classList.add("in")),
      1800
    )

    return () => {
      window.removeEventListener("scroll", reveal)
      window.removeEventListener("resize", reveal)
      clearTimeout(safety)
    }
  }, [])

  return null
}
