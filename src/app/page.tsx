import { cookies } from "next/headers";
import { getData } from "./actions/_shared";
import HabitsView from "./components/HabitsView";
import LoginView from "./components/LoginView";
import TimezoneDetector from "./components/TimezoneDetector";

export default async function Page() {
  const tz = (await cookies()).get("tz")?.value ?? "UTC";
  const data = await getData();

  return (
    <>
      <TimezoneDetector serverTz={tz} />
      {data ? <HabitsView {...data} /> : <LoginView />}
    </>
  );
}
