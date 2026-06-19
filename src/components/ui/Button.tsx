import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'default' | 'large'

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant
    size?: ButtonSize
  }
>

export const Button = ({ children, className = '', variant = 'primary', size = 'default', ...props }: ButtonProps) => (
  <button className={`button button--${variant} ${size === 'large' ? 'button--large' : ''} ${className}`.trim()} {...props}>
    {children}
  </button>
)
