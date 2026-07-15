import type { ButtonHTMLAttributes, ReactNode } from 'react'
import loadingSvg from '@/assets/loading.svg'
import styles from './Button.module.css'

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'success' | 'secondary'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  children?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${styles.btn} ${styles[variant]} ${styles[size]} ${loading ? styles.loading : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <img src={loadingSvg} className={styles.spinner} aria-hidden="true" />
      ) : icon ? (
        <span className={styles.iconSlot}>{icon}</span>
      ) : null}
      {children && <span className={styles.text}>{children}</span>}
    </button>
  )
}
