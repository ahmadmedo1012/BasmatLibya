import { i18nAr } from '@basmat/shared'
import { motion } from 'framer-motion'
import { PlansGrid } from '../components/primitives/PlansGrid.js'

export function PlansPage() {
  const labels = i18nAr.ar.plans

  return (
    <div className="max-w-6xl mx-auto">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-14"
      >
        <span className="text-labelSm uppercase tracking-widest text-primary">
          {i18nAr.ar.app.name}
        </span>
        <h1 className="text-displayMobile md:text-displayLg font-bold text-ink mt-3 mb-4 leading-tight">
          {labels.heading}
        </h1>
        <p className="text-bodyLg text-inkSoft max-w-2xl mx-auto leading-relaxed">
          {labels.subheading}
        </p>
      </motion.section>

      <PlansGrid current={null} />
    </div>
  )
}
