import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { useLocation } from "wouter";
import { Button } from "../../design/index.jsx";

type ButtonProps = ComponentProps<typeof Button>;

type LinkButtonProps = Omit<ButtonProps, "onClick"> & {
  href: string;
  children: ReactNode;
  /** Pass true if the href is external; renders a real anchor opening in a new tab. */
  external?: boolean;
};

function isOpenInNewTab(event: MouseEvent<HTMLElement>): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1;
}

/**
 * Anchor + design Button that uses wouter's client-side navigation by default,
 * while still supporting cmd/ctrl/middle click to open in a new tab.
 *
 * Avoids the invalid <a><button> nesting from wrapping <Button> inside <Link>.
 */
export default function LinkButton({ href, external, children, ...rest }: LinkButtonProps) {
  const [, setLocation] = useLocation();

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
        <Button {...rest}>{children}</Button>
      </a>
    );
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isOpenInNewTab(event)) {
      event.preventDefault();
      window.open(href, "_blank", "noopener");
      return;
    }
    event.preventDefault();
    setLocation(href);
  };

  return (
    <Button {...rest} onClick={handleClick}>
      {children}
    </Button>
  );
}
