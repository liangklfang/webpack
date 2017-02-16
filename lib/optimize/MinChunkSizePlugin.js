/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

class MinChunkSizePlugin {
	constructor(options) {
		if(typeof options !== "object" || Array.isArray(options)) {
			throw new Error("Argument should be an options object.\nFor more info on options, see https://webpack.github.io/docs/list-of-plugins.html");
		}
		this.options = options;
	}

	apply(compiler) {
		const options = this.options;
		const minChunkSize = options.minChunkSize;
		//minChunkSize： chunks smaller than this number will be merged
		compiler.plugin("compilation", (compilation) => {
			compilation.plugin("optimize-chunks-advanced", (chunks) => {
				let combinations = [];
				/*
				 var combinations = [];
				var chunks=[0,1,2,3]
				chunks.forEach((a, idx) => {
					for(let i = 0; i < idx; i++) {
						const b = chunks[i];
						combinations.push([b, a]);
					}
				});
				combinations是组合形式，把自己和前面比自己小的元素组合成为一个元素。之所以是选择比自己的
				小的情况是为了减少重复的个数，如[0,2]和[2,0]必须只有一个
				*/
				chunks.forEach((a, idx) => {
					for(let i = 0; i < idx; i++) {
						const b = chunks[i];
						combinations.push([b, a]);
					}
				});

				const equalOptions = {
					chunkOverhead: 1,
					// an additional overhead for each chunk in bytes (default 10000, to reflect request delay)
					entryChunkMultiplicator: 1
					//a multiplicator for entry chunks (default 10, entry chunks are merged 10 times less likely)
					//入口文件乘以的权重，所以如果含有入口文件，那么更加不容易小于minChunkSize，所以入口文件过小不容易被集成到别的chunk中
				};
				combinations = combinations.filter((pair) => {
					return pair[0].size(equalOptions) < minChunkSize || pair[1].size(equalOptions) < minChunkSize;
				});
               //对数组中元素进行删选，至少有一个chunk的值是小于minChunkSize的

				combinations.forEach((pair) => {
					const a = pair[0].size(options);
					const b = pair[1].size(options);
					const ab = pair[0].integratedSize(pair[1], options);
					//得到第一个chunk集成了第二个chunk后的文件大小
					pair.unshift(a + b - ab, ab);
					//这里的pair是如[0,1],[0,2]等这样的数组元素，前面加上两个元素：集成后总体积的变化量；集成后的体积
				});
				//此时combinations的元素至少有一个的大小是小于minChunkSize的
				combinations = combinations.filter((pair) => {
					return pair[1] !== false;
				});

				if(combinations.length === 0) return;
				//如果没有需要优化的，直接返回

				combinations.sort((a, b) => {
					const diff = b[0] - a[0];
					if(diff !== 0) return diff;
					return a[1] - b[1];
				});
				//按照我们的集成后变化的体积来比较，从大到小排序

				const pair = combinations[0];
				//得到第一个元素
				pair[2].integrate(pair[3], "min-size");
				//pair[2]是我们的chunk,pair[3]也是chunk
				chunks.splice(chunks.indexOf(pair[3]), 1);
				//从chunks集合中删除集成后的chunk
				return true;
			});
		});
	}
}
module.exports = MinChunkSizePlugin;
