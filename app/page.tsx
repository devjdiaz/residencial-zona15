import Nav from "@/components/front/Nav"
import Hero from "@/components/front/Hero"
import AvailabilitySection from "@/components/front/AvailabilitySection"
import RoomShowcases from "@/components/front/RoomShowcases"
import ServicesGrid from "@/components/front/ServicesGrid"
import HowItWorks from "@/components/front/HowItWorks"
import Conditions from "@/components/front/Conditions"
import Location from "@/components/front/Location"
import Contact from "@/components/front/Contact"
import Footer from "@/components/front/Footer"
import FloatingWhatsApp from "@/components/front/FloatingWhatsApp"
import RevealInit from "@/components/front/RevealInit"

export default function Home() {
  return (
    <div className="front-root">
      <a href="#main-content" className="skip-link">
        Saltar al contenido
      </a>

      <Nav />

      <main id="main-content">
        <Hero />
        <AvailabilitySection />
        <RoomShowcases />
        <ServicesGrid />
        <HowItWorks />
        <Conditions />
        <Location />
        <Contact />
      </main>

      <Footer />
      <FloatingWhatsApp />
      <RevealInit />
    </div>
  )
}
