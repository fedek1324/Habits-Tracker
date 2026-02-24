"use client";

import { useEffect } from "react";
import { setTimezoneAction } from "@/src/app/actions";

type Props = {
  /** Timezone currently stored in the cookie (may be "UTC" on first visit). */
  serverTz: string;
};

/**
 * Invisible component that detects the client's real timezone and syncs
 * it to a cookie so the Server Component can compute "today" correctly.
 * On first visit the server uses UTC; after this effect runs the page
 * re-renders with the correct timezone.
 */
export default function TimezoneDetector({ serverTz }: Props) {
  useEffect(() => {
    const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (clientTz && clientTz !== serverTz) {
      setTimezoneAction(clientTz);
    }
  }, [serverTz]);

  return null;
}
