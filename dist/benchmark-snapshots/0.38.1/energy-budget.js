/** Утверждённая цена дефицита: прежние1,5 здоровья/Т за0,36 энергии/Т
 * спокойного повторного ожидания. Плата здоровьем заменяет плоский голодный
 * штраф; неполученная энергия не становится расходом в энергетическом балансе. */
export const ENERGY_DEFICIT_FACTOR=25/6;
export function spendEnergy(w,a,cost,decision=false){
 const paid=Math.min(a.energy,cost),missing=cost-paid;a.energy=Math.max(0,a.energy-paid);
 w.stats.spent+=paid;if(decision)w.stats.brainSpent+=paid;else w.stats.actionSpent+=paid;
 if(missing>0)a.health=Math.max(0,a.health-ENERGY_DEFICIT_FACTOR*missing);
 return paid;
}
