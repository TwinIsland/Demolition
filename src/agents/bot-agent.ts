import { STAMINA } from "../core/stamina";
import { obscured } from "../core/equipment";
import { ITEMS, modifiedStat, RULES, SKILLS, perkById } from "../core/content";
import { blastCells, clearSight, slideBlocked } from "../core/geometry";
import { inTacticalView } from "../core/types";
import { DIRECTIONS, seededRandom } from "../core/maps";
import { canPlace, placementRadius } from "../core/placement";
import { SUMMON_TIME } from "../core/zombies";
import { idleInput } from "../core/types";
import type { AgentContext, Bomb, Difficulty, GameSnapshot, Player, PlayerAgent, SkillId, Vec2 } from "../core/types";
import { BombForecast } from "./bomb-forecast";
import { safeRoute } from "./tactical-route";

const settings = {
  easy:   { think:.48, depth:5, candidates:1, recovery:1.6, throwDelay:1.4 },
  normal: { think:.38, depth:7, candidates:2, recovery:1.45, throwDelay:1.3 },
  hard:   { think:.18, depth:10,candidates:5, recovery:.65, throwDelay:.7 },
};
const dist = (a:Vec2,b:Vec2) => Math.hypot(a.x-b.x,a.z-b.z);
const cell = (p:Vec2) => ({x:Math.round(p.x),z:Math.round(p.z)});
const same = (a:Vec2,b:Vec2) => a.x===b.x && a.z===b.z;
const normalWalk = .8;
const bearing = (from:Vec2,to:Vec2) => Math.atan2(from.x-to.x,from.z-to.z);
const turnDelta = (from:number,to:number) => Math.atan2(Math.sin(to-from),Math.cos(to-from));
const aimedAt = (p:Player,point:Vec2) => Math.abs(turnDelta(p.yaw,bearing(p,point))) < .42;
type Contact = Vec2 & { id:string; dx:number; dz:number; seen:number; readyAt:number };
type ThrowPlan = { kind:"grenade"|"smoke"; targetId:string|number; landing:Vec2; readyAt:number };

function visible(s:Readonly<GameSnapshot>, p:Player, other:Player, limitedView:boolean) {
  if (p.scanUntil>s.time) return true;
  if (obscured(s,p,other)) return false;
  if (limitedView) {
    const distance=dist(p,other);
    return distance<=9 && (distance<1.25 || Math.abs(turnDelta(p.yaw,bearing(p,other)))<Math.PI*5/12)
      && clearSight(s,p,other);
  }
  if (p.jammedUntil<=s.time) return true;
  const dx=other.x-p.x, dz=other.z-p.z, n=Math.ceil(Math.hypot(dx,dz)*3);
  if (-dx*Math.sin(p.yaw)-dz*Math.cos(p.yaw)<0) return false;
  for (let i=1;i<n;i++)
    if (s.tiles[Math.round(p.z+dz*i/n)]?.[Math.round(p.x+dx*i/n)]!==0) return false;
  return true;
}

function upgrade(p:Player) {
  const weight = (id:string) => {
    const perk = perkById(id);
    return perk?.aiPriority?.(p) ?? (perk?.tier === "gold" ? 6 : 4);
  };
  return p.offers.reduce((a,b)=>weight(a)>=weight(b)?a:b);
}

export class BotAgent implements PlayerAgent {
  private target?: Vec2;
  private contacts=new Map<string,Contact>();
  private nextThink=0;
  private nextBomb=0;
  private pendingThrow?: ThrowPlan;
  private aimTarget?: Vec2;
  private radarContact?: Vec2;
  private nextRadar=0;
  private sprintUntil=0;
  private nextSprint=0;
  private fleeing=false;
  constructor(readonly playerId:string) { this.reset(); }
  reset() {
    this.target=undefined;
    this.contacts.clear();
    this.nextThink=this.playerId==="mint" ? .07 : this.playerId==="sunny" ? .13 : .02;
    this.nextBomb=.8;
    this.pendingThrow=undefined;
    this.aimTarget=undefined;
    this.radarContact=undefined;
    this.nextRadar=0;
    this.sprintUntil=this.nextSprint=0;
    this.fleeing=false;
  }
  private observe(s:Readonly<GameSnapshot>,p:Player,limitedView:boolean,reaction:number) {
    for (const enemy of s.players) {
      if (enemy.id===p.id) continue;
      const last=this.contacts.get(enemy.id);
      if (!enemy.alive) { this.contacts.delete(enemy.id); continue; }
      if (!visible(s,p,enemy,limitedView)) {
        if (last && (last.seen<last.readyAt || s.time-last.seen>(limitedView ? .75 : 1.4)))
          this.contacts.delete(enemy.id);
        continue;
      }
      const elapsed=last ? Math.max(.001,s.time-last.seen) : 1;
      this.contacts.set(enemy.id,{id:enemy.id,x:enemy.x,z:enemy.z,seen:s.time,readyAt:last?.readyAt ?? s.time+reaction,
        dx:last ? (enemy.x-last.x)/elapsed : 0, dz:last ? (enemy.z-last.z)/elapsed : 0});
    }
    return [...this.contacts.values()].filter(contact=>contact.seen>=contact.readyAt);
  }
  private glanceAtRadar(s:Readonly<GameSnapshot>,p:Player,variation:number) {
    if (p.jammedUntil>s.time) { this.radarContact=undefined; return; }
    if (s.time<this.nextRadar) return;
    this.nextRadar=s.time+1.8+.8*variation;
    let nearest:Player | undefined;
    for (const other of s.players) {
      if (other.id!==p.id && other.alive && (!nearest || dist(p,other)<dist(p,nearest))) nearest=other;
    }
    // A sampled radar tile guides navigation. Only confirmed sightings can direct an attack.
    this.radarContact=nearest ? cell(nearest) : undefined;
  }
  decide({state:s,self:p,dt}:AgentContext) {
    const input=idleInput(p.yaw), difficulty=p.difficulty ?? s.difficulty ?? "normal", config=settings[difficulty];
    let weaponAim: Vec2 | undefined;
    if (p.offers.length) input.perk=upgrade(p);
    input.usePerk = p.perks.find(id => perkById(id)?.aiShouldUse?.(p,s));
    if (s.phase==="countdown") {
      const list: SkillId[] = this.playerId==="sunny" ? ["scan","surge","medic"] :
        difficulty==="hard" ? ["kick","surge","medic"] : ["surge","medic","jam","shift"];
      input.buy=list.find(id=>SKILLS[id] && !p.skills.includes(id) && p.credits>=SKILLS[id].price);
      return input;
    }
    if (s.phase!=="playing") return input;
    const normal = difficulty === "normal";
    const overhead = inTacticalView(p,s.time);
    const walkScale = normal ? normalWalk : 1;
    if (s.time>=this.nextThink) {
      // Per-seat timing varies between decisions and can be reproduced from the match seed.
      const variation = normal ? seededRandom(s.seed ^ Math.imul(s.players.findIndex(seat=>seat.id===p.id)+1,2654435761) ^
        Math.round(s.time/RULES.step))() : 0;
      this.nextThink=s.time+config.think+.14*variation;
      const recovery=config.recovery+.22*variation;
      const enemies=this.observe(s,p,normal,normal ? .28+.16*variation : 0);
      if (normal) this.glanceAtRadar(s,p,variation);
      const navigationContacts = enemies.length || !this.radarContact ? enemies : [this.radarContact];
      const f=new BombForecast(s), here=cell(p);
      const value=(c:Vec2) => {
        const item=s.items.find(i=>same(i,c));
        const loot=item ? (ITEMS[item.kind].aiPickupValue?.(p) ?? 19) : 0;
        const cover=DIRECTIONS.filter(d=>s.tiles[c.z+d.z]?.[c.x+d.x]===2).length;
        const nearest=Math.min(15,...navigationContacts.map(e=>dist(e,c)));
        const undead=Math.min(6,...s.zombies.map(z=>dist(z,c)));
        return loot+cover*2.8-nearest*1.1-Math.max(0,2.5-undead)*8;
      };
      const route=safeRoute(s,p,f,config.depth,value,false,walkScale);
      this.target=route?.first ?? DIRECTIONS.map(d=>({x:here.x+d.x,z:here.z+d.z}))
        .find(c=>s.tiles[c.z]?.[c.x]===0 && !f.occupied(c.x,c.z,0,.4) && !f.burning(c.x,c.z,.15,.65)) ?? here;
      const ready=(id:SkillId)=>p.skills.includes(id) && p.cooldowns[id]<=s.time;
      let bestPriority=0;
      for (const id of p.skills) {
        const skill=SKILLS[id];
        if (!ready(id) || !skill?.aiCastPriority || (skill.canActivate && !skill.canActivate(p,s.time))) continue;
        const priority=skill.aiCastPriority(p,s.time,enemies);
        if (priority>bestPriority) { input.skill=id; bestPriority=priority; }
      }
      this.fleeing = f.burning(here.x,here.z,0,1.4) || s.zombies.some(z => dist(z,p) < 3);
      if (normal && this.fleeing && s.time>=this.nextSprint && p.stamina>=STAMINA.restart) {
        this.sprintUntil=s.time+.6+.22*variation;
        this.nextSprint=this.sprintUntil+1.2;
      }
      if (!overhead && this.fleeing && !p.shield && p.inventory.shield > 0 && ITEMS.shield?.onUse) {
        input.equip = "shield";
        input.bomb = true;
      } else if (!overhead && p.maxHp-p.hp >= 30 && p.inventory.bandage > 0) {
        input.equip = "bandage";
        input.bomb = true;
      }
      const knife = ITEMS.knife?.melee;
      if (!overhead && !input.bomb && knife && (p.cooldowns["equipment:knife"] ?? 0) <= s.time) {
        const contacts=normal ? enemies.filter(e=>e.seen===s.time) : enemies;
        weaponAim = [...contacts,...s.zombies].find(enemy => dist(enemy,p) <= knife.reach && clearSight(s,p,enemy));
        if (weaponAim) {
          input.equip = "knife";
          input.bomb = !normal || (p.equipped==="knife" && aimedAt(p,weaponAim));
        }
      }
      if (!input.bomb && !weaponAim && s.time>=this.nextBomb && !f.burning(here.x,here.z,0,.7)) {
        const plan = overhead ? undefined : this.planThrow(s,p,enemies,config.throwDelay+.18*variation);
        this.pendingThrow = plan;
        if (plan) {
          input.equip = plan.kind;
          if (plan.kind === "grenade") weaponAim = plan.landing;
          if (s.time >= plan.readyAt && (!normal || plan.kind==="smoke" || aimedAt(p,plan.landing))) {
            input.bomb = true;
            input.bombTarget = plan.kind === "smoke" ? here : plan.landing;
            input.throwMode = plan.kind === "smoke" ? "direct" : "lob";
            this.pendingThrow = undefined;
            this.nextBomb = s.time + recovery;
          }
        }
        const tactic=!plan && this.attack(s,p,enemies,difficulty,ready("surge") && !input.skill);
        if (tactic) {
          this.target=tactic.first;
          if (overhead && !tactic.kick) input.plantAtFeet = true;
          else if (!tactic.kick) {
            input.equip="bomb";
            if (normal && dist(p,tactic.target)>.6) weaponAim=tactic.target;
            input.bomb=!weaponAim || aimedAt(p,weaponAim);
            if (input.bomb) input.bombTarget=tactic.target;
          }
          if (tactic.kick) this.nextThink = s.time + Math.max(config.think,(dist(p,tactic.target)-.72)/p.speed+.08);
          if (tactic.boost && input.bomb) input.skill="surge";
          if (input.bomb || input.plantAtFeet || tactic.kick) this.nextBomb=s.time+recovery;
        }
      } else this.pendingThrow = undefined;
      this.aimTarget = normal ? weaponAim : undefined;
    }
    if (this.target) {
      let dx=this.target.x-p.x,dz=this.target.z-p.z;
      // Center in the corridor before turning across a solid corner.
      if (Math.abs(dx)>.5 && Math.abs(dz)>.04 && Math.abs(dz)<.5) dx=0;
      else if (Math.abs(dz)>.5 && Math.abs(dx)>.04 && Math.abs(dx)<.5) dz=0;
      const d=Math.hypot(dx,dz);
      if (d>.015) {
        input.sprint = this.fleeing && (!normal || s.time<this.sprintUntil);
        const pace = input.sprint ? STAMINA.speedFactor : 1;
        const scale=walkScale/Math.max(d,p.speed*pace*walkScale*dt);
        input.moveX=dx*scale; input.moveZ=dz*scale; input.yaw=Math.atan2(-dx,-dz);
      }
    }
    if (this.pendingThrow?.kind === "grenade") weaponAim = this.pendingThrow.landing;
    const standing = !input.moveX && !input.moveZ;
    const lookTarget=weaponAim ?? this.aimTarget ?? (normal && standing ? this.radarContact : undefined);
    if (lookTarget) input.yaw=bearing(p,lookTarget);
    if (normal) {
      const maxTurn=Math.PI*dt;
      input.yaw=p.yaw+Math.max(-maxTurn,Math.min(maxTurn,turnDelta(p.yaw,input.yaw)));
    }
    return input;
  }

  private planThrow(s:Readonly<GameSnapshot>, p:Player, contacts:Contact[], delay:number): ThrowPlan | undefined {
    const here = cell(p);
    const smoke = p.hp < p.maxHp*.5 && !obscured(s,p,p) && canPlace(s,p,here,"smoke");
    if (!p.inventory.grenade && !smoke) return;

    const threats = [...contacts.filter(e => e.seen===s.time),
      ...s.zombies.filter(z => z.spawnAt === undefined || s.time >= z.spawnAt + SUMMON_TIME)]
      .filter(e => p.scanUntil > s.time || (clearSight(s,p,e) && !obscured(s,p,e)));
    const old = this.pendingThrow;
    const inRange = threats.filter(e => dist(cell(e),p) > 2.7 && canPlace(s,p,cell(e),"grenade","lob"));
    const enemy = inRange.find(e => e.id === old?.targetId) ?? inRange[0];
    const threat = enemy ?? (smoke && threats.find(e => dist(e,p) <= 6));
    if (!threat) return;
    const kind = enemy ? "grenade" : "smoke";
    if (old?.kind === kind && old.targetId === threat.id &&
        (kind === "smoke" || (dist(old.landing,p) > 2.7 && canPlace(s,p,old.landing,kind,"lob")))) return old;
    // Commit to the observed tile so strafing after the windup starts can beat the throw.
    return {kind,targetId:threat.id,landing:enemy ? cell(enemy) : here,readyAt:s.time+delay};
  }

  private attack(s:Readonly<GameSnapshot>,p:Player,enemies:Contact[],difficulty:Difficulty,canBoost:boolean) {
    const here=cell(p), hard=difficulty==="hard", config=settings[difficulty];
    const radius=difficulty==="easy" || inTacticalView(p,s.time) ? 0 : Math.floor(placementRadius(p,s.time));
    const choices: { bomb:Bomb; boost:boolean; kick:boolean; score:number; first?:Vec2 }[]=[];
    const scoreHit=(cells:Vec2[],ownerId=p.id)=>{
      const hits=(c:Vec2)=>cells.some(hit=>same(hit,cell(c)));
      let value=cells.filter(c=>s.tiles[c.z][c.x]===2).length*3;
      for (const z of s.zombies) if (hits(z)) value+=3+z.level*2;
      for (const e of enemies) {
        if (e.id===ownerId) continue;
        if (hits(e)) value+=9;
        if (!hard || dist(p,e)>10) continue;
        const at=cell(e);
        const exits=DIRECTIONS.map(d=>({x:at.x+d.x,z:at.z+d.z})).filter(c=>s.tiles[c.z]?.[c.x]===0);
        if (exits.length) value+=8*exits.filter(hits).length/exits.length;
        const ahead=cell({x:e.x+Math.max(-1,Math.min(1,e.dx*.65)),z:e.z+Math.max(-1,Math.min(1,e.dz*.65))});
        if (!same(at,ahead) && hits(ahead)) value+=6;
      }
      return value;
    };
    for (let z=here.z-radius;z<=here.z+radius;z++) for (let x=here.x-radius;x<=here.x+radius;x++) {
      if (!canPlace(s,p,{x,z})) continue;
      const active=p.surgeUntil>s.time;
      for (const boost of canBoost && !active && enemies.some(e=>dist(p,e)<7) ? [false,true] : [false]) {
        const bomb:Bomb={x,z,id:-1,range:modifiedStat(boost ? {...p,surgeUntil:s.time+1} : p,"bombRange",p.range,s.time),ownerId:p.id,blastDuration:modifiedStat(p,"blastDuration",RULES.blastDuration,s.time),detonateAt:s.time+RULES.fuse,passThrough:[p.id]};
        const score=scoreHit(blastCells(s,bomb))-(boost?1:0);
        if (score>0) choices.push({bomb,boost,kick:false,score});
      }
    }
    if (hard && p.skills.includes("kick")) for (const b of s.bombs) {
      const dx=b.x-here.x,dz=b.z-here.z;
      if (Math.abs(dx)+Math.abs(dz)!==1 || b.slide || b.passThrough.includes(p.id)) continue;
      const delay=Math.max(.03,(dist(b,p)-.72)/p.speed);
      const x=b.x+dx,z=b.z+dz;
      if (slideBlocked(s,x,z) || b.detonateAt<=s.time+delay+.2) continue;
      const bomb={...b,slide:{x:dx,z:dz,arrivedAt:s.time+delay}};
      const shifted=new BombForecast(s,undefined,bomb);
      const score=scoreHit(shifted.footprints.get(b.id) ?? [],b.ownerId)-scoreHit(blastCells(s,b),b.ownerId)+2;
      if (score>2) choices.push({bomb,boost:false,kick:true,score,first:cell(b)});
    }
    choices.sort((a,b)=>b.score-a.score || dist(p,b.bomb)-dist(p,a.bomb));
    for (const choice of choices.slice(0,config.candidates)) {
      const f=choice.kick ? new BombForecast(s,undefined,choice.bomb) : new BombForecast(s,choice.bomb);
      const escape=safeRoute(s,p,f,config.depth,()=>0,true,difficulty==="normal" ? normalWalk : 1);
      if (escape && (!choice.kick || !f.burning(choice.bomb.x,choice.bomb.z,0,.6)))
        return {first:choice.first ?? escape.first,target:cell(choice.bomb),boost:choice.boost,kick:choice.kick};
    }
  }
}
