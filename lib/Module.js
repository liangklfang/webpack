/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var DependenciesBlock = require("./DependenciesBlock");
var ModuleReason = require("./ModuleReason");
var Template = require("./Template");

var debugId = 1000;

function Module() {
	DependenciesBlock.call(this);
	this.context = null;
	this.reasons = [];
	this.debugId = debugId++;
	this.lastId = -1;
	this.id = null;
	this.portableId = null;
	this.index = null;
	this.index2 = null;
	this.depth = null;
	this.used = null;
	this.usedExports = null;
	this.providedExports = null;
	this.chunks = [];
	this.warnings = [];
	this.dependenciesWarnings = [];
	this.errors = [];
	this.dependenciesErrors = [];
	this.strict = false;
	this.meta = {};
}
module.exports = Module;

Module.prototype = Object.create(DependenciesBlock.prototype);
Module.prototype.constructor = Module;

Object.defineProperty(Module.prototype, "entry", {
	configurable: false,
	get: function() {
		throw new Error("Module.entry was removed. Use Chunk.entryModule");
	},
	set: function() {
		throw new Error("Module.entry was removed. Use Chunk.entryModule");
	}
});

Module.prototype.disconnect = function() {
	this.reasons.length = 0;
	this.lastId = this.id;
	this.id = null;
	this.index = null;
	this.index2 = null;
	this.depth = null;
	this.used = null;
	this.usedExports = null;
	this.providedExports = null;
	this.chunks.length = 0;
	DependenciesBlock.prototype.disconnect.call(this);
};

Module.prototype.unseal = function() {
	this.lastId = this.id;
	this.id = null;
	this.index = null;
	this.index2 = null;
	this.depth = null;
	this.chunks.length = 0;
	DependenciesBlock.prototype.unseal.call(this);
};

Module.prototype.addChunk = function(chunk) {
	var idx = this.chunks.indexOf(chunk);
	if(idx < 0)
		this.chunks.push(chunk);
};

Module.prototype._removeAndDo = require("./removeAndDo");

Module.prototype.removeChunk = function(chunk) {
	return this._removeAndDo("chunks", chunk, "removeModule");
};

//添加reason
Module.prototype.addReason = function(module, dependency) {
	this.reasons.push(new ModuleReason(module, dependency));
};
//我们的ModuleReason就只有module和dependency两个字段
Module.prototype.removeReason = function(module, dependency) {
	for(var i = 0; i < this.reasons.length; i++) {
		var r = this.reasons[i];
		if(r.module === module && r.dependency === dependency) {
			this.reasons.splice(i, 1);
			return true;
		}
	}
	return false;
};

//module必须通过reason.module.chunk来获取chunk
Module.prototype.hasReasonForChunk = function(chunk) {
	for(var i = 0; i < this.reasons.length; i++) {
		var r = this.reasons[i];
		if(r.chunks) {
			if(r.chunks.indexOf(chunk) >= 0)
				return true;
		} else if(r.module.chunks.indexOf(chunk) >= 0)
			return true;
	}
	return false;
};

function addToSet(set, items) {
	items.forEach(function(item) {
		if(set.indexOf(item) < 0)
			set.push(item);
	});
}

//调用m.rewriteChunkInReasons(other, [this]);
Module.prototype.rewriteChunkInReasons = function(oldChunk, newChunks) {
	this.reasons.forEach(function(r) {
		//如果这个reason不存在
		if(!r.chunks) {
			if(r.module.chunks.indexOf(oldChunk) < 0)
				return;
			r.chunks = r.module.chunks;
		}
		r.chunks = r.chunks.reduce(function(arr, c) {
			addToSet(arr, c !== oldChunk ? [c] : newChunks);
			//如果reason中的chunk不是以前的chunk，那么原样写入，否则如果是一样的chunk,直接采用新的chunk替换
			return arr;
		}, []);
	});
};

Module.prototype.isUsed = function(exportName) {
	if(this.used === null) return exportName;
	if(!exportName) return this.used ? true : false;
	if(!this.used) return false;
	if(!this.usedExports) return false;
	if(this.usedExports === true) return exportName;
	var idx = this.usedExports.indexOf(exportName);
	if(idx < 0) return false;
	if(this.isProvided(exportName))
		return Template.numberToIdentifer(idx);
	return exportName;
};

Module.prototype.isProvided = function(exportName) {
	if(!Array.isArray(this.providedExports))
		return null;
	return this.providedExports.indexOf(exportName) >= 0;
};

Module.prototype.toString = function() {
	return "Module[" + (this.id || this.debugId) + "]";
};

Module.prototype.needRebuild = function(fileTimestamps, contextTimestamps) {
	return true;
};

Module.prototype.updateHash = function(hash) {
	hash.update(this.id + "" + this.used);
	hash.update(JSON.stringify(this.usedExports));
	DependenciesBlock.prototype.updateHash.call(this, hash);
};

function byId(a, b) {
	return a.id - b.id;
}

Module.prototype.sortItems = function() {
	DependenciesBlock.prototype.sortItems.call(this);
	this.chunks.sort(byId);
	this.reasons.sort(function(a, b) {
		return byId(a.module, b.module);
	});
};

Module.prototype.unbuild = function() {
	this.disconnect();
};

Module.prototype.identifier = null;
Module.prototype.readableIdentifier = null;
Module.prototype.build = null;
Module.prototype.source = null;
Module.prototype.size = null;
Module.prototype.nameForCondition = null;
