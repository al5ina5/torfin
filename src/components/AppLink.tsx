import type { ComponentPropsWithoutRef, MouseEvent } from 'react'

import { handleAppLinkClick } from '../lib/app-link'

type AppLinkProps = Omit<ComponentPropsWithoutRef<'a'>, 'href'> & {
  href: string
  onNavigate?: () => void
}

export function AppLink({ href, onNavigate, onClick, className, ...rest }: AppLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (event.defaultPrevented || !onNavigate) return
    handleAppLinkClick(event, onNavigate)
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className={className ? `no-underline ${className}` : 'no-underline'}
      {...rest}
    />
  )
}
