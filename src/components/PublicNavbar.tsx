/**
 * PublicNavbar — Barra de navegação pública do imoB365
 *
 * Menu espelhado de imob365.com.br:
 *   Home | Sobre | Imóveis ▾ | Blog | Consultoria | Contato
 *   + CTA: Entrar | Agendar Conversa (WhatsApp)
 *
 * Para integrar: importe e use em __root.tsx ou em cada rota pública.
 * Se já existe um SiteHeader, substitua seu conteúdo por este ou copie os links.
 */

import { useState, useEffect } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu, X, Phone, Building2, FileText, Users, Home, Info, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const WHATSAPP_URL = 'https://wa.me/+5513997794382?text=Ol%C3%A1!%20Gostaria%20de%20agendar%20uma%20consultoria.'
const PHONE = '(13) 99779-4382'

const IMOVEIS_SUBMENU = [
  {
    href: '/buscar?tipo=apartamento',
    label: 'Apartamentos',
    desc: 'Unidades residenciais no Litoral Sul',
  },
  {
    href: '/buscar?tipo=apartamento-alto-padrao',
    label: 'Alto Padrão',
    desc: 'Coberturas e Garden frente ao mar',
  },
  {
    href: '/buscar?tipo=casa',
    label: 'Casas',
    desc: 'Residências e casas de praia',
  },
  {
    href: '/buscar?tipo=terreno',
    label: 'Terrenos',
    desc: 'Terrenos para construção e incorporação',
  },
  {
    href: '/buscar?tipo=comercial',
    label: 'Corporativo',
    desc: 'Salas comerciais e investimento',
  },
  {
    href: '/buscar',
    label: 'Ver todos os imóveis →',
    desc: 'Portfólio completo de R$ 3 MI',
    highlight: true,
  },
]

const NAV_LINKS = [
  { href: '/sobre', label: 'Sobre a imoB365', icon: Info },
  { href: '/blog', label: 'Blog', icon: FileText },
  { href: '/consultoria', label: 'Consultoria', icon: Users },
  { href: '/contato', label: 'Contato', icon: Phone },
]

export function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-border/50'
          : 'bg-white/80 backdrop-blur-sm',
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* ── Logo ── */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg tracking-tight">
                imo<span className="text-primary">B365</span>
              </span>
            </div>
          </Link>

          {/* ── Desktop nav ── */}
          <nav className="hidden lg:flex items-center gap-1">
            <NavigationMenu>
              <NavigationMenuList>
                {/* Home */}
                <NavigationMenuItem>
                  <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                    <Link
                      to="/"
                      className={cn(isActive('/') && pathname === '/' && 'text-primary font-semibold')}
                    >
                      Home
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                {/* Sobre */}
                <NavigationMenuItem>
                  <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                    <Link
                      to="/sobre"
                      className={cn(isActive('/sobre') && 'text-primary font-semibold')}
                    >
                      Sobre
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                {/* Imóveis — com submenu */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger
                    className={cn(isActive('/buscar') && 'text-primary font-semibold')}
                  >
                    Imóveis
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-1 p-4 md:w-[500px] md:grid-cols-2">
                      {IMOVEIS_SUBMENU.map((item) => (
                        <li key={item.href}>
                          <NavigationMenuLink asChild>
                            <Link
                              to={item.href}
                              className={cn(
                                'block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors',
                                'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
                                item.highlight && 'col-span-2 bg-primary/5 hover:bg-primary/10',
                              )}
                            >
                              <div
                                className={cn(
                                  'text-sm font-medium leading-none',
                                  item.highlight && 'text-primary',
                                )}
                              >
                                {item.label}
                              </div>
                              <p className="line-clamp-2 text-xs leading-snug text-muted-foreground mt-1">
                                {item.desc}
                              </p>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Blog */}
                <NavigationMenuItem>
                  <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                    <Link
                      to="/blog"
                      className={cn(isActive('/blog') && 'text-primary font-semibold')}
                    >
                      Blog
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                {/* Consultoria */}
                <NavigationMenuItem>
                  <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                    <Link
                      to="/consultoria"
                      className={cn(isActive('/consultoria') && 'text-primary font-semibold')}
                    >
                      Consultoria
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                {/* Contato */}
                <NavigationMenuItem>
                  <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                    <Link
                      to="/contato"
                      className={cn(isActive('/contato') && 'text-primary font-semibold')}
                    >
                      Contato
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </nav>

          {/* ── CTAs desktop ── */}
          <div className="hidden lg:flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4" />
                Agendar Conversa
              </a>
            </Button>
          </div>

          {/* ── Mobile hamburger ── */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" aria-label="Menu">
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 pt-12">
              <nav className="flex flex-col gap-1">
                <MobileLink to="/" label="Home" icon={Home} onClick={() => setMobileOpen(false)} />
                <MobileLink to="/sobre" label="Sobre a imoB365" icon={Info} onClick={() => setMobileOpen(false)} />

                {/* Imóveis expandido no mobile */}
                <div className="px-3 py-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Imóveis
                  </p>
                  <div className="flex flex-col gap-0.5 pl-2">
                    {IMOVEIS_SUBMENU.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'text-sm py-1.5 px-2 rounded-md transition-colors',
                          'hover:bg-accent hover:text-accent-foreground',
                          item.highlight && 'text-primary font-medium',
                        )}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                {NAV_LINKS.map((link) => (
                  <MobileLink
                    key={link.href}
                    to={link.href}
                    label={link.label}
                    icon={link.icon}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}

                <div className="mt-4 flex flex-col gap-2 px-3">
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/login" onClick={() => setMobileOpen(false)}>
                      Entrar
                    </Link>
                  </Button>
                  <Button asChild className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white">
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="w-4 h-4" />
                      Agendar Conversa
                    </a>
                  </Button>
                </div>

                <div className="mt-6 px-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{PHONE}</p>
                  <p>contato@imob365.com.br</p>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

function MobileLink({
  to,
  label,
  icon: Icon,
  onClick,
}: {
  to: string
  label: string
  icon: React.ElementType
  onClick: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <Icon className="w-4 h-4 text-muted-foreground" />
      {label}
    </Link>
  )
}
