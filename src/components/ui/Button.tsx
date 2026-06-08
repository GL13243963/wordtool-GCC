import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant
  }
>

export const Button = ({ children, className = '', variant = 'primary', ...props }: ButtonProps) => (
  <button className={`button button--${variant} ${className}`.trim()} {...props}>
    {children}
  </button>
)
