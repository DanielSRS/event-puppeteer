import { describe, expect, test } from "vitest";
import { PublicTags, ToEventDetail, ToFeedCard, ToTvEvent } from "./mappers";
import type { FeedEvent, LinkLabel, Tag } from "./schemas";

const TAGS: Tag[] = [
  { id: "tech", name: "Tecnologia", isSystemDefined: true },
  { id: "free", name: "robotica", isSystemDefined: false },
];
const LABELS: LinkLabel[] = [{ id: "signup", name: "Inscrição" }];

const EVENT: FeedEvent = {
  id: "e1",
  title: "Feira de Ciências",
  description: "Projetos",
  location: "Pátio",
  creatorId: "u1",
  organizationId: "o1",
  isHidden: false,
  isDeleted: false,
  createdAt: "2026-10-01T00:00:00Z",
  schedule: [
    { eventId: "e1", date: "2026-10-12", startTime: "14:00", endTime: "16:00" },
    { eventId: "e1", date: "2026-10-11" },
  ],
  tags: [{ eventId: "e1", tagId: "tech", isFreeForm: false }, { eventId: "e1", tagId: "free", isFreeForm: true }],
  links: [{ eventId: "e1", labelId: "signup", url: "https://example.org" }, { eventId: "e1", labelId: "gone", url: "https://x.org" }],
  voteCount: 4,
  weight: 400,
};

test("PublicTags keeps only system-defined tags", () => {
  expect(PublicTags(EVENT, TAGS)).toEqual([{ id: "tech", name: "Tecnologia" }]);
});

describe("ToFeedCard", () => {
  test("anonymous viewer", () => {
    const card = ToFeedCard(EVENT, TAGS, { viewerId: null, viewerVoted: false, pending: undefined });
    expect(card).toMatchObject({ id: "e1", voteCount: 4, voted: false, isOwn: false, tags: [{ id: "tech", name: "Tecnologia" }] });
    expect(card.schedule.map((d) => d.date)).toEqual(["2026-10-11", "2026-10-12"]);
    expect(card.schedule[0]).toEqual({ date: "2026-10-11" });
  });

  test("creator who voted, with a pending unlike", () => {
    const card = ToFeedCard(EVENT, TAGS, { viewerId: "u1", viewerVoted: true, pending: { voted: false, before: true, settlesAt: null } });
    expect(card).toMatchObject({ voteCount: 3, voted: false, isOwn: true });
  });
});

test("ToEventDetail resolves labels and coordinates", () => {
  const banner = { url: "https://img", thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI" };
  const detail = ToEventDetail({ ...EVENT, latitude: -12.2, longitude: -38.9, banner }, TAGS, LABELS);
  expect(detail.coordinates).toEqual({ latitude: -12.2, longitude: -38.9 });
  expect(detail.banner).toEqual(banner);
  expect(detail.links).toEqual([{ label: "Inscrição", url: "https://example.org" }, { label: null, url: "https://x.org" }]);

  const plain = ToEventDetail({ ...EVENT, latitude: -12.2 }, TAGS, LABELS);
  expect(plain.coordinates).toBeNull();
  expect(plain.banner).toBeNull();
});

test("ToTvEvent", () => {
  expect(ToTvEvent(EVENT)).toMatchObject({ id: "e1", voteCount: 4, location: "Pátio" });
});
