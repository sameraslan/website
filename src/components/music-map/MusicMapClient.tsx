"use client";

import dynamic from "next/dynamic";

const MusicMap = dynamic(
  () => import("./MusicMap").then((m) => m.MusicMap),
  { ssr: false }
);

export default function MusicMapClient() {
  return <MusicMap />;
}
