export const CONFIG = {
  whatsappNumber: "50241211335",
  whatsappDisplay: "+502 4121 1335",
  guardianName: "Julio",
  guardianTel: "tel:+50241211335",
  address: "17 Avenida D 0-22, Zona 15, Colonia El Maestro, Ciudad de Guatemala",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=17+Avenida+D+0-22+Zona+15+Ciudad+de+Guatemala",
  mapsEmbedUrl:
    "https://www.google.com/maps?q=14.594524,-90.497563&output=embed",
  wazeUrl: "https://waze.com/ul?ll=14.594524,-90.497563&navigate=yes",
  hours: "Lunes a viernes · 8:00 – 19:00",
  hoursSat: "Sábados hasta el mediodía",
  wa(message: string) {
    return `https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(message)}`
  },
  waDefault:
    "Hola Julio, vi la página del Residencial El Maestro en Zona 15 y me gustaría más información sobre las habitaciones disponibles.",
  waVisit:
    "Hola Julio, me gustaría agendar una visita a Residencial El Maestro.",
  waAvail:
    "Hola Julio, quisiera que me avisaran cuando haya una habitación disponible en el Residencial.",
}
