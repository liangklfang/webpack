/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
	preferEntry (boolean) give entry chunks higher priority. 
	This make entry chunks smaller but increases the overall size. (recommended)
    为什么给最多使用的chunk最小的id，原因是webpack每次查询都是一次循环
*/
"use strict";

class OccurrenceOrderPlugin {
	constructor(preferEntry) {
		if(preferEntry !== undefined && typeof preferEntry !== "boolean") {
			throw new Error("Argument should be a boolean.\nFor more info on this plugin, see https://webpack.github.io/docs/list-of-plugins.html");
		}
		this.preferEntry = preferEntry;
		//给入口文件更高的权重
	}
	apply(compiler) {
		const preferEntry = this.preferEntry;
		compiler.plugin("compilation", (compilation) => {
			compilation.plugin("optimize-module-order", (modules) => {

               //这个module.chunks集合中的chunk，如果是isInitial或者entryModule就是1！
				function entryChunks(m) {
					return m.chunks.map((c) => {
						//如果chunk.entryModule是我们的module，那么得到1
						const sum = (c.isInitial() ? 1 : 0) + (c.entryModule === m ? 1 : 0);
						//isInitial通过commonchunkplugin提取
						return sum;
					}).reduce((a, b) => {
						return a + b;
					}, 0);
				}
                
                //判断一个模块在入口文件中出现的次数
				function occursInEntry(m) {
					if(typeof m.__OccurenceOrderPlugin_occursInEntry === "number") return m.__OccurenceOrderPlugin_occursInEntry;
					//这个模块在入口文件中出现的次数
					const result = m.reasons.map((r) => {
						if(!r.module) return 0;
						return entryChunks(r.module);
					}).reduce((a, b) => {
						return a + b;
					}, 0) + entryChunks(m);
					return m.__OccurenceOrderPlugin_occursInEntry = result;
					//这个模块添加一个数__OccurenceOrderPlugin_occursInEntry
				}


                //一个模块出现的次数＝sum(m.reason.chunks.length)+module.chunks.length+module.chunks中entryModel等于当前model
                //module出现的次数＝module在reason中出现的次数＋module.chunks中出现的次数＋module.chunks中的entryModule
				function occurs(m) {
					if(typeof m.__OccurenceOrderPlugin_occurs === "number") return m.__OccurenceOrderPlugin_occurs;
					const result = m.reasons.map((r) => {
						//不是获取入口文件了，而是直接判断module.reason.chunks.length
						//来获取该模块被调用的次数
						if(!r.module) return 0;
						return r.module.chunks.length;
					}).reduce((a, b) => {
						return a + b;
						//模块出现在哪些chunks中
					}, 0) + m.chunks.length + m.chunks.filter((c) => {
						c.entryModule === m;
					}).length;
					return m.__OccurenceOrderPlugin_occurs = result;
				}

				//"optimize-module-order"传入的是modules集合
				modules.sort((a, b) => {
					if(preferEntry) {
						//从模块在入口文件中出现的次数来排序
						const aEntryOccurs = occursInEntry(a);
						const bEntryOccurs = occursInEntry(b);
						if(aEntryOccurs > bEntryOccurs) return -1;
						if(aEntryOccurs < bEntryOccurs) return 1;
					}
					
					const aOccurs = occurs(a);
					const bOccurs = occurs(b);
					//模块出现的次数
					if(aOccurs > bOccurs) return -1;
					if(aOccurs < bOccurs) return 1;
					//按照模块出现的次数排序
					if(a.identifier() > b.identifier()) return 1;
					if(a.identifier() < b.identifier()) return -1;
					//按照模块的identifier进行排序
					return 0;
				});
				// TODO refactor to Map
				modules.forEach((m) => {
					m.__OccurenceOrderPlugin_occursInEntry = undefined;
					m.__OccurenceOrderPlugin_occurs = undefined;
				});
			});

			//下面是对chunk的id进行优化
			compilation.plugin("optimize-chunk-order", (chunks) => {
				//获取该chunk的父级chunk中是initial chunk的个数
				function occursInEntry(c) {
					if(typeof c.__OccurenceOrderPlugin_occursInEntry === "number") return c.__OccurenceOrderPlugin_occursInEntry;
					const result = c.parents.filter((p) => {
						return p.isInitial();
					}).length;
					return c.__OccurenceOrderPlugin_occursInEntry = result;
				}
              
				function occurs(c) {
					return c.blocks.length;
				}

				//对chunk中的module按照module的identifier从小到大排序，identifier越小越出现在前面
				//所以chunk下的module已经排列好了
				chunks.forEach((c) => {
					c.modules.sort((a, b) => {
						if(a.identifier() > b.identifier()) return 1;
						if(a.identifier() < b.identifier()) return -1;
						return 0;
					});
				});

				//对chunk本身进行排序,提取的次数越多越靠前，这样他的chunkID就会越小。不管有没有
				//commonchunkplugin，我们获取该模块的重要程度都是通过判断在父级chunk中出现的次数来完成的
				//如require.ensure产生的0.entry.chunk.js的parents就只有main这一个chunk
				chunks.sort((a, b) => {
					const aEntryOccurs = occursInEntry(a);
					const bEntryOccurs = occursInEntry(b);
					if(aEntryOccurs > bEntryOccurs) return -1;
					if(aEntryOccurs < bEntryOccurs) return 1;
					//entry从大到小排列，该chunk在经过commonchunkplugin提取的次数越多越靠前
					const aOccurs = occurs(a);
					const bOccurs = occurs(b);
					if(aOccurs > bOccurs) return -1;
					if(aOccurs < bOccurs) return 1;
					//chunk.block的降序排列，如main.js通过require.ensure产生的block的个数，block个数越多越靠前
					if(a.modules.length > b.modules.length) return -1;
					if(a.modules.length < b.modules.length) return 1;
					//chunk.modules表示该chunk出现在module中的次数越多，那么排序越靠前
					for(let i = 0; i < a.modules.length; i++) {
						if(a.modules[i].identifier() > b.modules[i].identifier()) return -1;
						if(a.modules[i].identifier() < b.modules[i].identifier()) return 1;
					}
					return 0;
				});
				// TODO refactor to Map
				chunks.forEach((c) => {
					c.__OccurenceOrderPlugin_occursInEntry = undefined;
				});
			});
		});
	}
}

module.exports = OccurrenceOrderPlugin;
