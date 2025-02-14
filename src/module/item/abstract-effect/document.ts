import { ActorPF2e } from "@actor";
import { ItemPF2e } from "@item";
import { TokenDocumentPF2e } from "@scene";
import { ErrorPF2e, sluggify } from "@util";
import { EffectBadge } from "./data";
import { UUIDUtils } from "@util/uuid-utils";

/** Base effect type for all PF2e effects including conditions and afflictions */
export abstract class AbstractEffectPF2e extends ItemPF2e {
    /** A normalized version of the slug that shows in roll options, removing certain prefixes */
    rollOptionSlug!: string;

    abstract get badge(): EffectBadge | null;

    abstract increase(): Promise<void>;
    abstract decrease(): Promise<void>;

    /** Get the actor from which this effect originated */
    get origin(): ActorPF2e | null {
        const actorOrToken = this.isOfType("affliction", "effect")
            ? UUIDUtils.fromUuidSync(this.system.context?.origin.actor ?? "")
            : null;

        return actorOrToken instanceof ActorPF2e
            ? actorOrToken
            : actorOrToken instanceof TokenDocumentPF2e
            ? actorOrToken.actor
            : this.actor;
    }

    /** If true, the AbstractEffect should be hidden from the user unless they are a GM */
    get unidentified(): boolean {
        return false;
    }

    override getRollOptions(prefix = this.type): string[] {
        const originRollOptions = new Set(
            this.origin?.getRollOptions().map((o) => o.replace(/^(?:self:)?/, `${prefix}:origin:`)) ?? []
        );

        return [
            ...super.getRollOptions(prefix),
            ...Object.entries({
                [`badge:type:${this.badge?.type}`]: !!this.badge,
                [`badge:value:${this.badge?.value}`]: !!this.badge,
            })
                .filter(([, isTrue]) => isTrue)
                .map(([key]) => `${prefix}:${key}`),
            ...originRollOptions,
        ];
    }

    override prepareBaseData(): void {
        super.prepareBaseData();

        const slug = this.slug ?? sluggify(this.name);
        this.rollOptionSlug = slug.replace(/^(?:[a-z]+-)?(?:effect|stance)-/, "");
    }

    /** Set a self roll option for this effect */
    override prepareActorData(): void {
        const actor = this.actor;
        if (!actor) throw ErrorPF2e("prepareActorData called from unembedded item");

        actor.rollOptions.all[`self:${this.type}:${this.rollOptionSlug}`] = true;

        // Add the badge value to roll options but only if it is a number and the highest value
        const badge = this.badge;
        if (typeof badge?.value === "number") {
            const otherEffects = actor.items.filter(
                (i): i is Embedded<AbstractEffectPF2e> =>
                    i instanceof AbstractEffectPF2e && i.rollOptionSlug === this.rollOptionSlug
            );
            const values = otherEffects
                .map((effect) => effect.badge?.value)
                .filter((value): value is number => typeof value === "number");
            if (badge.value >= Math.max(...values)) {
                actor.rollOptions.all[`self:${this.type}:${this.rollOptionSlug}:${badge.value}`] = true;
            }
        }
    }
}
