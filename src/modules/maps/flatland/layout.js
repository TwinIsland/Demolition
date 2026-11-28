// The Flatland starter village at full size, cell by cell: the map matches are fought on. The
// layout never changes. The story plays on the small one (`../flatland-story`).
//
// Open ground:   .  grass     ,  dirt road     +  cobbled plaza     :  tilled field
// Destructible:  c  wooden crate     f  plank fence     o  anything from the village pool
// Permanent:     #  boundary wall    w  low stone wall    L  lantern
//                T  tree    R  rock    G  gravestone    B  notice stone
//                X  jukebox: whoever stands by it can change the music of the match
//                t  pier of an arch (two piers carry one arch over the cell between them)
//                K  tavern    M  market (the skill shop)    S  church    N  smithy    Y  windmill
//                D E  training ground    H J  house    I U  cottage
//                (two letters: entrance to the south, entrance to the north)
import { villagePlan } from "./plan.js";

export const LAYOUT = [
  "#####################",
  "#.........o..IIoo...#",
  "#...o.HHT.,c.IIcc...#",
  "#.....HH..,o...oc.o.#",
  "#o.c,,,,oL,L,o,,oc.o#",
  "#.oooo..oo,.oKKK,oTo#",
  "#cT.,MMM.t,t.KKK,...#",
  "#c..,MMMo.,o.KKK,.c.#",
  "#oo.,oo.L+++L..o,To.#",
  "#coRLo.T+++++.t.L.R.#",
  "#co,,o,,++X++,,,,o,,#",
  "#.T.L..o+++++.t.LoG.#",
  "#..o,NNoL+++L...,...#",
  "#.YYoNNo.o,.EEEE,SS.#",
  "#cYY,.wwwT,oEEEE,SS.#",
  "#:::,oo...,.c...,SS.#",
  "#:::,o,,,L,L,,,,,c.o#",
  "#:::.oJJc.oco.T...G.#",
  "#.::..JJoc,.UUoGoG..#",
  "#......o.o,oUU..o...#",
  "#####################",
];
export const SIZE = LAYOUT.length;

export const { symbolAt, featureAt, tileAt, groundAt, obstacleAt } = villagePlan(LAYOUT);
