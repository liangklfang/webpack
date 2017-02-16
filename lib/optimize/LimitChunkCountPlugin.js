/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra

	Limit the chunk count to a defined value. Chunks are merged until it fits.
把chunk的数量限制在一定的范围之内，否则合并chunk.

options.maxChunks (number) max number of chunks

options.chunkOverhead (number) an additional overhead for each chunk in bytes (default 10000, to reflect request delay)

options.entryChunkMultiplicator (number) a multiplicator for entry chunks (default 10, entry chunks are merged 10 times less likely)
*/
"use strict";

class LimitChunkCountPlugin {
	constructor(options) {
		if(options !== undefined && typeof options !== "object" || Array.isArray(options)) {
			throw new Error("Argument should be an options object.\nFor more info on options, see https://webpack.github.io/docs/list-of-plugins.html");
		}
		this.options = options || {};
	}
	apply(compiler) {
		const options = this.options;
		compiler.plugin("compilation", (compilation) => {

           
           //这里的每次chunks变化后都会重新运行一次，所以可以减少体积
			compilation.plugin("optimize-chunks-advanced", (chunks) => {
				const maxChunks = options.maxChunks;
				//最多的chunk数量
				if(!maxChunks) return;
				//未指定最大的chunk，那么直接返回不需要该plugin处理
				if(maxChunks < 1) return;
				if(chunks.length <= maxChunks) return;
                //需要该插件处理
				if(chunks.length > maxChunks) {
					let combinations = [];
					chunks.forEach((a, idx) => {
						for(let i = 0; i < idx; i++) {
							const b = chunks[i];
							combinations.push([b, a]);
						}
					});
					//这是一个组合

					combinations.forEach((pair) => {
						const a = pair[0].size(options);
						const b = pair[1].size(options);
						const ab = pair[0].integratedSize(pair[1], options);
						pair.unshift(a + b - ab, ab);
						pair.push(a, b);
						//每一个元素前面添加两个元素，分别为合并后减小的体积和合并后的体积
						//最后也push两个元素，分别为两个chunk的体积
					});
					combinations = combinations.filter((pair) => {
						return pair[1] !== false;
					});
					combinations.sort((a, b) => {
						const diff = b[0] - a[0];
						if(diff !== 0) return diff;
						return a[1] - b[1];
					});
					//按照体积大小排序，体积变化从大到小排序，如果体积没有变化按照体积从小到大

					const pair = combinations[0];
					//得到第一个元素

					if(pair && pair[2].integrate(pair[3], "limit")) {
						//移除paire[3]
						chunks.splice(chunks.indexOf(pair[3]), 1);
						return true;
					}
				}
			});
		});
	}
}
module.exports = LimitChunkCountPlugin;
