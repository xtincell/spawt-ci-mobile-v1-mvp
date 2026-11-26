import { useEffect, useRef, type ReactNode } from "react";
import mokaSalut from "../assets/mascots/moka-salut.png";

type StaffAccessProps = {
  title: string;
  description?: string;
  focusTitleOnMount?: boolean;
  children: ReactNode;
};

/**
 * Candidate isolated from the admin shell: staff authentication and recovery
 * share the same SPAWT visual language without changing shared controls.
 */
export function StaffAccess({ title, description, children, focusTitleOnMount }: StaffAccessProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusTitleOnMount) titleRef.current?.focus();
  }, [focusTitleOnMount]);

  return (
    <main className="staff-access">
      <section className="staff-access__card" aria-labelledby="staff-access-title">
        <img className="staff-access__moka" src={mokaSalut} alt="" />
        <h1 ref={titleRef} tabIndex={focusTitleOnMount ? -1 : undefined} id="staff-access-title" className="staff-access__title">{title}</h1>
        {description && <p className="staff-access__description">{description}</p>}
        {children}
      </section>
    </main>
  );
}
