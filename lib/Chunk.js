/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const compareLocations = require("./compareLocations");
let debugId = 1000;
const removeAndDo = require("./removeAndDo");

const byId = (a, b) => {
	if(a.id < b.id) return -1;
	if(b.id < a.id) return 1;
	return 0;
};

class Chunk {

	constructor(name, module, loc) {
		this.id = null;
		this.ids = null;
		this.debugId = debugId++;
		this.name = name;
		this.modules = [];
		//entrypoints数组没有弄明白
		this.entrypoints = [];
		this.chunks = [];
		this.parents = [];

		//以下数组没有弄明白
		this.blocks = [];
		//该chunk包含了哪些block如requireEnsureBlock，和我们的chunk本身是循环引用
		/*
		 this.blocks.forEach(b => {
					const idx = b.chunks.indexOf(this);
					if(idx >= 0) {
						b.chunks.splice(idx, 1);
						if(b.chunks.length === 0) {
							b.chunks = null;
							b.chunkReason = reason;
						}
					}
				}, this);
		也就是说chunk的blocks属性的chunks属性是对chunk的循环引用
		chunk->blocks->chunks
		*/
		this.origins = [];
		this.files = [];
		this.rendered = false;
		this._removeAndDo = removeAndDo;
		this.addChunk = this.createAdder("chunks");
		this.addParent = this.createAdder("parents");
		if(module) {
			this.origins.push({
				module,
				loc,
				name
			});
		}
	}

	createAdder(collection) {
		const createAdderCallback = (chunk) => {
			if(chunk === this) {
				return false;
			}
			if(this[collection].indexOf(chunk) >= 0) {
				return false;
			}
			this[collection].push(chunk);
			return true;
		};
		return createAdderCallback;
	}

	get entry() {
		throw new Error("Chunk.entry was removed. Use hasRuntime()");
	}

	set entry(data) {
		throw new Error("Chunk.entry was removed. Use hasRuntime()");
	}

	get initial() {
		throw new Error("Chunk.initial was removed. Use isInitial()");
	}

	set initial(data) {
		throw new Error("Chunk.initial was removed. Use isInitial()");
	}

	hasRuntime() {
		if(this.entrypoints.length === 0) return false;
		return this.entrypoints[0].chunks[0] === this;
	}

	isInitial() {
		return this.entrypoints.length > 0;
	}

   //是否有入口模块
	hasEntryModule() {
		return !!this.entryModule;
	}

	addModule(module) {
		if(this.modules.indexOf(module) >= 0) {
			return false;
		}
		this.modules.push(module);
		return true;
	}

	removeModule(module) {
		this._removeAndDo("modules", module, "removeChunk");
	}

	removeChunk(chunk) {
		this._removeAndDo("chunks", chunk, "removeParent");
	}

	removeParent(chunk) {
		this._removeAndDo("parents", chunk, "removeChunk");
	}

	addBlock(block) {
		if(this.blocks.indexOf(block) >= 0) {
			return false;
		}
		this.blocks.push(block);
		return true;
	}

	addOrigin(module, loc) {
		this.origins.push({
			module,
			loc,
			name: this.name
		});
	}

   //移除这个chunk时候添加的reason，是chunk调用
   //这个方法就像c语言中断开我们的指针是一样的，需要把父级和子级链接起来，既要考虑当前chunk的父级也要考虑子级
   //所以会出现addParent和addChunk
	remove(reason) {
		this.modules.slice().forEach(m => {
			m.removeChunk(this);
		}, this);
       //所有的module不再出现在这个chunk中
		this.parents.forEach(c => {
			const idx = c.chunks.indexOf(this);
			if(idx >= 0) {
				c.chunks.splice(idx, 1);
			}
			this.chunks.forEach(cc => {
				cc.addParent(c);
			});
		}, this);
        //将该chunk从其父级chunk的chunks数组中移除，表示该chunk不再来源于其父级chunk
        //我的子级chunk的父级chunk更新为我没有移除之前的这个父级chunk
		this.chunks.forEach(c => {
			const idx = c.parents.indexOf(this);
			if(idx >= 0) {
				c.parents.splice(idx, 1);
			}
			this.parents.forEach(cc => {
				cc.addChunk(c);
			});
		}, this);
        //把子级chunk的parents属性中移除当前这个chunk，同时把当前chunk的parent中添加一个我的子级chunk
        //注意：一个addParent和addChunk一般都是同时出现的，就像c语言中断开指针一样

		this.blocks.forEach(b => {
			const idx = b.chunks.indexOf(this);
			if(idx >= 0) {
				b.chunks.splice(idx, 1);
				if(b.chunks.length === 0) {
					b.chunks = null;
					b.chunkReason = reason;
				}
			}
		}, this);
       //更新chunk的block属性，其中block有如requirensureBlock等

	}

	moveModule(module, other) {
		module.removeChunk(this);
		module.addChunk(other);
		other.addModule(module);
		module.rewriteChunkInReasons(this, [other]);
	}

   //pair[2].integrate(pair[3], "min-size");
	integrate(other, reason) {
		if(!this.canBeIntegrated(other)) {
			return false;
		}
		const otherModules = other.modules.slice();
		//获取要集成的chunk的所有module
		//因为webpack中到处是循环引用，所以这里先调用module三次方法然后调用chunk的一次方法
		otherModules.forEach(m => {
			m.removeChunk(other);
			//把模块从other chunk中移除
			m.addChunk(this);
			//表明这个module到当前chunk中了
			this.addModule(m);
			//把模块移到当前chunk中
			m.rewriteChunkInReasons(other, [this]);
			//对每一个模块里面的chunk.reason全部进行更新，以前该module的reason是other这个chunk
			//现在全部修改为module.reasons.chunk为当前的chunk。reason是通过module来访问chunk的
		}, this);

		other.modules.length = 0;
		//把other这个chunk的模块都移除，其实上面已经移除这里是修改数组的length

		const moveChunks = (chunks, kind, onChunk) => {
			chunks.forEach(c => {
				const idx = c[kind].indexOf(other);
				if(idx >= 0) {
					c[kind].splice(idx, 1);
				}
				onChunk(c);
			});
		};

		//把other这个chunk从父级中除名，因为父级的chunks集合就是表明其子级chunk的，把它
		//从子级chunks集合中移除
		moveChunks(other.parents, "chunks", c => {
			if(c !== this && this.addParent(c)) {
				c.addChunk(this);
			}
		});
		other.parents.length = 0;
        //把other这个chunk的父级chunk置空，标签other这个chunk不存在父级chunk了。

		moveChunks(other.chunks, "parents", c => {
			if(c !== this && this.addChunk(c)) {
				c.addParent(this);
			}
		});
        //other的chunks表明时子级chunk，子级chunk的parent也不再是当前chunk了！
		other.chunks.length = 0;

        //other这个chunk的blocks进行修改，如果他恒等于other，那么修改为当前的this，也就是调用者
		other.blocks.forEach(b => {
			b.chunks = (b.chunks || [this]).map(c => {
				return c === other ? this : c;
			}, this);
			//更新chunks
			b.chunkReason = reason;
			this.addBlock(b);
			//把other对应的block添加到this中
		}, this);
		other.blocks.length = 0;


		other.origins.forEach(origin => {
			this.origins.push(origin);
		}, this);
		//把other这个chunk的origins添加到this中

		this.origins.forEach(origin => {
			if(!origin.reasons) {
				origin.reasons = [reason];
			} else if(origin.reasons[0] !== reason) {
				origin.reasons.unshift(reason);
			}
		});
       //为origins中添加reasons

		this.chunks = this.chunks.filter(c => {
			return c !== other && c !== this;
		});
       //子级chunk过滤

		this.parents = this.parents.filter(c => {
			return c !== other && c !== this;
		});
		//parent chunk过过滤
		return true;
	}

	split(newChunk) {
		const _this = this;
		this.blocks.forEach(b => {
			newChunk.blocks.push(b);
			b.chunks.push(newChunk);
		});
		this.chunks.forEach(c => {
			newChunk.chunks.push(c);
			c.parents.push(newChunk);
		});
		this.parents.forEach(p => {
			p.chunks.push(newChunk);
			newChunk.parents.push(p);
		});
		this.entrypoints.forEach(e => {
			e.insertChunk(newChunk, _this);
		});
	}

   //如果这个chunk下面没有module就是空的chunk
	isEmpty() {
		return this.modules.length === 0;
	}

	updateHash(hash) {
		hash.update(`${this.id} `);
		hash.update(this.ids ? this.ids.join(",") : "");
		hash.update(`${this.name || ""} `);
		this.modules.forEach(m => m.updateHash(hash));
	}

   /*
      const equalOptions = {
			chunkOverhead: 1,
			// an additional overhead for each chunk in bytes (default 10000, to reflect request delay)
			entryChunkMultiplicator: 1
			//a multiplicator for entry chunks (default 10, entry chunks are merged 10 times less likely)
		};
   */
	size(options) {
		const CHUNK_OVERHEAD = typeof options.chunkOverhead === "number" ? options.chunkOverhead : 10000;
		const ENTRY_CHUNK_MULTIPLICATOR = options.entryChunkMultiplicator || 10;
		const modulesSize = this.modules.reduce((a, b) => {
			return a + b.size();
		}, 0);
		//得到该chunk所有的模块的大小
		return modulesSize * (this.isInitial() ? ENTRY_CHUNK_MULTIPLICATOR : 1) + CHUNK_OVERHEAD;
	}

    //如果需要集成的是initial chunk，比如入口文件，或者Commonchunkplugin产生的chunk都是不能集成的
    //因为入口文件不会有重复的，而且common chunkplugin产生的也不会有重复的
	canBeIntegrated(other) {
		if(other.isInitial()) {
			return false;
		}
		if(this.isInitial()) {
			//如果自己是initial chunk，那么集成的那个chunk必须满足两个条件：
			//必须有一个父级chunk，同时需要集成的那个chunk的parent是当前chunk
			//这种情况，比如main通过require.ensure产生了0.entry.chunk.js和1.entry.chunk.js
			//这时候main是可以集成0.entry.chunk.js和1.entry.chunk.js的
			if(other.parents.length !== 1 || other.parents[0] !== this) {
				return false;
			}
		}
		return true;
	}

    //调用方式为：pair[0].integratedSize(pair[1], options);
	integratedSize(other, options) {
		// Chunk if it's possible to integrate this chunk
		if(!this.canBeIntegrated(other)) {
			return false;
		}
		const CHUNK_OVERHEAD = typeof options.chunkOverhead === "number" ? options.chunkOverhead : 10000;
		const ENTRY_CHUNK_MULTIPLICATOR = options.entryChunkMultiplicator || 10;
		const mergedModules = this.modules.slice();
		//获取所有的模块集合
		other.modules.forEach(m => {
			if(this.modules.indexOf(m) < 0) {
				mergedModules.push(m);
			}
		}, this);
		//如果需要集成的这个chunk的有些module在当前这个chunk中不存在，那么把需要集成的哪些module添加进来

		const modulesSize = mergedModules.reduce((a, m) => {
			return a + m.size();
		}, 0);
		//得到集成后的模块的总大小
		return modulesSize * (this.isInitial() || other.isInitial() ? ENTRY_CHUNK_MULTIPLICATOR : 1) + CHUNK_OVERHEAD;
	}

	getChunkMaps(includeEntries, realHash) {
		const chunksProcessed = [];
		const chunkHashMap = {};
		const chunkNameMap = {};
		(function addChunk(c) {
			if(chunksProcessed.indexOf(c) >= 0) return;
			chunksProcessed.push(c);
			if(!c.hasRuntime() || includeEntries) {
				chunkHashMap[c.id] = realHash ? c.hash : c.renderedHash;
				if(c.name)
					chunkNameMap[c.id] = c.name;
			}
			c.chunks.forEach(addChunk);
		}(this));
		return {
			hash: chunkHashMap,
			name: chunkNameMap
		};
	}

	sortItems() {
		this.modules.sort(byId);
		this.origins.sort((a, b) => {
			const aIdent = a.module.identifier();
			const bIdent = b.module.identifier();
			if(aIdent < bIdent) return -1;
			if(aIdent > bIdent) return 1;
			return compareLocations(a.loc, b.loc);
		});
		this.origins.forEach(origin => {
			if(origin.reasons)
				origin.reasons.sort();
		});
		this.parents.sort(byId);
		this.chunks.sort(byId);
	}

	toString() {
		return `Chunk[${this.modules.join()}]`;
	}

	checkConstraints() {
		const chunk = this;
		chunk.chunks.forEach((child, idx) => {
			if(chunk.chunks.indexOf(child) !== idx)
				throw new Error(`checkConstraints: duplicate child in chunk ${chunk.debugId} ${child.debugId}`);
			if(child.parents.indexOf(chunk) < 0)
				throw new Error(`checkConstraints: child missing parent ${chunk.debugId} -> ${child.debugId}`);
		});
		chunk.parents.forEach((parent, idx) => {
			if(chunk.parents.indexOf(parent) !== idx)
				throw new Error(`checkConstraints: duplicate parent in chunk ${chunk.debugId} ${parent.debugId}`);
			if(parent.chunks.indexOf(chunk) < 0)
				throw new Error(`checkConstraints: parent missing child ${parent.debugId} <- ${chunk.debugId}`);
		});
	}
}

module.exports = Chunk;
