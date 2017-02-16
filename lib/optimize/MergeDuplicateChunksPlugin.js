/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

function getChunkIdentifier(chunk) {
	//chunk的identifer来自于module的identifier集合字符串
	return chunk.modules.map((m) => {
		return m.identifier();
	}).sort().join(", ");
}

//Chunks with the same modules are merged.
class MergeDuplicateChunksPlugin {
	apply(compiler) {
		compiler.plugin("compilation", (compilation) => {
			compilation.plugin("optimize-chunks-basic", (chunks) => {
				const map = {};
				chunks.slice().forEach((chunk) => {
					if(chunk.hasRuntime() || chunk.hasEntryModule()) return;
					//不会合成hasRuntime和hasEntryModule的chunk
					const ident = getChunkIdentifier(chunk);
					//以这个chunk的identifier作为map对象的key
					if(map[ident]) {
						if(map[ident].integrate(chunk, "duplicate"))
							chunks.splice(chunks.indexOf(chunk), 1);
						//集成后面的chunk如果能够成功，那么就删除后面的chunk
						return;
					}
					map[ident] = chunk;
					//map的key是chunk的identifier，而value是chunk的内容本身
				});
			});
		});
	}
}
module.exports = MergeDuplicateChunksPlugin;
