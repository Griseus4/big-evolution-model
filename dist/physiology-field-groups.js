/** Группы редактора. Значения, единицы и пределы принадлежат реестру физики;
 * здесь только порядок показа. Каждое поле встречается ровно в одной группе. */
export const PHYSIOLOGY_FIELD_GROUPS=Object.freeze([
 ['body','Тело и вместимость',['referenceMass','organFraction','energyPerMass','healthPerMass','volumePerOrgan','inventoryCapacity','founderEnergyFraction','newbornEnergyFraction']],
 ['tissue','Содержание тканей, рост и голод',['tissueEnergy','synthesisEfficiency','catabolismEfficiency','tissueRate','catabolismGrowthFactor','deficitDamage','growthThreshold']],
 ['food','Пища и содержание пищеварения',['grassEnergy','fruitEnergy','meatEnergy','digestionRate','digestionReferenceVolume','digestionReferencePower']],
 ['actions','Действия: время, расход энергии и объём',['conceiveRate','conceiveSteps','moveRate','gatherRate','eatRate','depositRate','feedRate','gatherSteps','eatSteps','feedSteps','depositSteps','birthSteps','attackSteps','portionPerAction']],
 ['movement','Скорость перемещения',['speedPeak','speedDecline','speedRightFloor']],
 ['attack','Атаки',['attackDamage','attackMoveFraction']],
 ['healing','Лечение',['healingPrice','healingReserve','healingDeficitFraction','healingMinimumFraction']],
 ['resources','Трава, останки и порча мяса',['remainsOrganFraction','grassMin','grassMax','grassRegrowth','meatHalfLife']],
].map(([id,title,keys])=>Object.freeze({id,title,keys:Object.freeze(keys)})));
