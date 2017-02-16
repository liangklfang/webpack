/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

class RemoveEmptyChunksPlugin {

	apply(compiler) {
		compiler.plugin("compilation", (compilation) => {
			compilation.plugin(["optimize-chunks-basic", "optimize-extracted-chunks-basic"], (chunks) => {
             //优化chunk和抽取出来的chunk内容
				chunks.filter((chunk) => chunk.isEmpty() && !chunk.hasRuntime() && !chunk.hasEntryModule())
				      //过滤出来的chunk有以下条件：(1)内部有module (2)没有执行环境  (3)没有EntryModule
				      //第一个条件很容易理解 
				      //第二个条件，比如通过commonchunkplugin提取出来的顶层的plugin虽然是空的，但是是含有执行环境的，不能移除的
				      //第三个条件：表示我们在webpack.config.js中配置的entry产生的chunk也是不能移除的
					.forEach((chunk) => {
						chunk.remove("empty");
						//接受一个参数表示reason
						chunks.splice(chunks.indexOf(chunk), 1);
						//从chunks数组中移除
					});
			});
		});
	}
}
module.exports = RemoveEmptyChunksPlugin;
