/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var nextIdent = 0;

function CommonsChunkPlugin(options) {
	if(arguments.length > 1) {
		throw new Error("Deprecation notice: CommonsChunkPlugin now only takes a single argument. Either an options " +
			"object *or* the name of the chunk.\n" +
			"Example: if your old code looked like this:\n" +
			"    new webpack.optimize.CommonsChunkPlugin('vendor', 'vendor.bundle.js')\n\n" +
			"You would change it to:\n" +
			"    new webpack.optimize.CommonsChunkPlugin({ name: 'vendor', filename: 'vendor.bundle.js' })\n\n" +
			"The available options are:\n" +
			"    name: string\n" +
			"    names: string[]\n" +
			"    filename: string\n" +
			"    minChunks: number\n" +
			"    chunks: string[]\n" +
			"    children: boolean\n" +
			"    async: boolean\n" +
			"    minSize: number\n");
	}
	if(Array.isArray(options) || typeof options === "string") {
		options = {
			name: options
		};
	}
	this.chunkNames = options.name || options.names;
	this.filenameTemplate = options.filename;
	//commonChunkPlugin传入的文件名
	this.minChunks = options.minChunks;
	this.selectedChunks = options.chunks;
	if(options.children) this.selectedChunks = false;
	this.async = options.async;
	//是否配置了async
	this.minSize = options.minSize;
	this.ident = __filename + (nextIdent++);
}

module.exports = CommonsChunkPlugin;
CommonsChunkPlugin.prototype.apply = function(compiler) {
	var chunkNames = this.chunkNames;
	var filenameTemplate = this.filenameTemplate;
	//文件名
	var minChunks = this.minChunks;
	var selectedChunks = this.selectedChunks;
	var asyncOption = this.async;
	var minSize = this.minSize;
	var ident = this.ident;
	compiler.plugin("this-compilation", function(compilation) {
		compilation.plugin(["optimize-chunks", "optimize-extracted-chunks"], function(chunks) {
			// only optimize once
			if(compilation[ident]) return;
			compilation[ident] = true;

			var commonChunks;
			if(!chunkNames && (selectedChunks === false || asyncOption)) {
				commonChunks = chunks;
			} else if(Array.isArray(chunkNames) || typeof chunkNames === "string") {
				commonChunks = [].concat(chunkNames).map(function(chunkName) {
					var chunk = chunks.filter(function(chunk) {
						return chunk.name === chunkName;
					})[0];
					if(!chunk) {
						chunk = this.addChunk(chunkName);
					}
					return chunk;
				}, this);
			} else {
				throw new Error("Invalid chunkNames argument");
			}
			commonChunks.forEach(function processCommonChunk(commonChunk, idx) {
				var usedChunks;
				if(Array.isArray(selectedChunks)) {
					usedChunks = chunks.filter(function(chunk) {
						if(chunk === commonChunk) return false;
						//此时commonChunk的内容是已经存在于最终的文件中了，如果它不是手动创建的chunk
						//去掉下例的jquery,得到usedChunks集合
						/*
						  var CommonsChunkPlugin = require("webpack/lib/optimize/CommonsChunkPlugin");
						module.exports = {
						    entry: {
						        main: process.cwd()+'/example6/main.js',
						        main1: process.cwd()+'/example6/main1.js',
						        jquery:["jquery"]
						    },
						    output: {
						        path: process.cwd()  + '/dest/example6',
						        filename: '[name].js'
						    },
						    plugins: [
						        new CommonsChunkPlugin({
						            name: "jquery",
						            minChunks:2,
						            chunks:["main","main1"]
						        })
						    ]
						};
						*/
						return selectedChunks.indexOf(chunk.name) >= 0;
					});
				} else if(selectedChunks === false || asyncOption) {
					usedChunks = (commonChunk.chunks || []).filter(function(chunk) {
						// we can only move modules from this chunk if the "commonChunk" is the only parent
						//只是把一级子chunk的公共内容提取出来，如果有一个子chunk的父级chunk有两个那么不会被提取出来。
						return asyncOption || chunk.parents.length === 1;
					});
				} else {

					//如果当前的这个chunk有多个父级chunk，那么不会提取的
					if(commonChunk.parents.length > 0) {
						compilation.errors.push(new Error("CommonsChunkPlugin: While running in normal mode it's not allowed to use a non-entry chunk (" + commonChunk.name + ")"));
						return;
					}
					/*
					  module.exports = {
					    entry: {
					        main: process.cwd()+'/example3/main.js',
					        main1: process.cwd()+'/example3/main1.js',
					        common1:["jquery"],
					        common2:["vue"]
					    },
					    output: {
					        path: process.cwd()+'/dest/example3',
					        filename: '[name].js'
					    },
					    plugins: [
					        new CommonsChunkPlugin({
					            name: ["chunk",'common1','common2'],
					            minChunks:2
					        })
					    ]
					};
					*/
					usedChunks = chunks.filter(function(chunk) {
						var found = commonChunks.indexOf(chunk);
						if(found >= idx) return false;
						return chunk.hasRuntime();
					});
				}
				if(asyncOption) {
					var asyncChunk = this.addChunk(typeof asyncOption === "string" ? asyncOption : undefined);
					asyncChunk.chunkReason = "async commons chunk";
					asyncChunk.extraAsync = true;
					asyncChunk.addParent(commonChunk);
					commonChunk.addChunk(asyncChunk);
					//创建一个新的chunk同时父级设置为commonChunk
					commonChunk = asyncChunk;
				}
				var reallyUsedModules = [];
				//得到chunk中每一个module的出现次数
				if(minChunks !== Infinity) {
					var commonModulesCount = [];
					var commonModules = [];
					usedChunks.forEach(function(chunk) {
						chunk.modules.forEach(function(module) {
							var idx = commonModules.indexOf(module);
							if(idx < 0) {
								commonModules.push(module);
								commonModulesCount.push(1);
							} else {
								commonModulesCount[idx]++;
							}
						});
					});

					//得到满足出现次数的module集合，reallyUsedModules
					var _minChunks = (minChunks || Math.max(2, usedChunks.length));
					commonModulesCount.forEach(function(count, idx) {
						var module = commonModules[idx];
						if(typeof minChunks === "function") {
							if(!minChunks(module, count))
								return;
						} else if(count < _minChunks) {
							return;
						}
						if(module.chunkCondition && !module.chunkCondition(commonChunk))
							return;
						reallyUsedModules.push(module);
					});
				}

				//所有module文件体积要足够大才创建chunk
				if(minSize) {
					var size = reallyUsedModules.reduce(function(a, b) {
						return a + b.size();
					}, 0);
					if(size < minSize)
						return;
				}
				var reallyUsedChunks = [];

				//把公共使用的模块从chunk中移除，并把移除了公共部分的chunk添加到reallyUsedChunks集合中
				//此时usedChunks是移除了公共chunk的内容
				reallyUsedModules.forEach(function(module) {
					usedChunks.forEach(function(chunk) {
						if(module.removeChunk(chunk)) {
							if(reallyUsedChunks.indexOf(chunk) < 0)
								reallyUsedChunks.push(chunk);
						}
					});
					//把公共模块添加到common chunk也就是上面例子的jquery的chunk中
					commonChunk.addModule(module);
					module.addChunk(commonChunk);
					//表明这个module出现在了common chunk中
				});
				if(asyncOption) {
					reallyUsedChunks.forEach(function(chunk) {
						if(chunk.isInitial())
							return;
						//满足使用次数的chunk的block.chunks添加一个chunk
						chunk.blocks.forEach(function(block) {
							block.chunks.unshift(commonChunk);
							commonChunk.addBlock(block);
						});
					});
					asyncChunk.origins = reallyUsedChunks.map(function(chunk) {
						return chunk.origins.map(function(origin) {
							var newOrigin = Object.create(origin);
							newOrigin.reasons = (origin.reasons || []).slice();
							newOrigin.reasons.push("async commons");
							return newOrigin;
						});
					}).reduce(function(arr, a) {
						arr.push.apply(arr, a);
						return arr;
					}, []);
				} else {
					//此时usedChunks是移除了公共chunk的内容，添加parents属性，同时添加chunk属性表明commonChunk是从哪些chunk提取的
					usedChunks.forEach(function(chunk) {
						chunk.parents = [commonChunk];
						//[ Entrypoint { name: 'main', chunks: [ [Object] ] } ]
						//[ Entrypoint { name: 'main1', chunks: [ [Object] ] } ]
						chunk.entrypoints.forEach(function(ep) {
							ep.insertChunk(commonChunk, chunk);
							//修改了entryPoint的chunk，也同时修改了commonChunk的entrypoint
						});
						//每一个移除了公共chunk的chunk.entrypoints添加一个chunk
						commonChunk.addChunk(chunk);
					});
				}
				//我们为chunk添加了一个filenameTemplate，这个属性表示生成文件时候的文件名称
				if(filenameTemplate)
					commonChunk.filenameTemplate = filenameTemplate;
			}, this);
			return true;
		});
	});
};
