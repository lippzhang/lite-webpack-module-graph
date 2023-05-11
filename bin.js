//导入包
const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const babel = require('@babel/core')

//处理函数
function stepOne(filename){
    // 读入文件
    const ast = readFile(filename)
    // 遍历AST抽象语法🌲
    const dependencies = traverseAST(ast, filename)
    
    //通过@babel/core和@babel/preset-env进行代码的转换
    const { code } = babel.transformFromAst(ast, null, {
        presets: ["@babel/preset-env"]
    })
    
    //返回文件名称，和依赖关系
    return {
        filename,
        dependencies,
        code
    }
}

// 最近可能是看了代码整洁之道之后，就会特别注意命名合理性和代码块不在同一层尽力不放在一起，即使这只是一个demo
function readFile(filename){
    const content =  fs.readFileSync(filename, 'utf-8')
    const ast = parser.parse(content, {
        sourceType: 'module'//babel官方规定必须加这个参数，不然无法识别ES Module
    })
    return ast
}

function traverseAST(ast, filename){
    const dependencies = {}
    traverse(ast, {
        //获取通过import引入的模块
        ImportDeclaration({node}){
            const dirname = path.dirname(filename)
            const newFile = './' + path.join(dirname, node.source.value)
            //保存所依赖的模块
            dependencies[node.source.value] = newFile
        }
    })
    return dependencies
}

function stepTwo(entry){

  // 先拿到带有依赖的AST对象
  const entryModule = stepOne(entry)
  console.log('entryModule', entryModule)
  // 下面就是深度算法运用部分
  const graphArray = getGraphArray(entryModule)
  console.log('graphArray', graphArray)
  // 接下来就是生成图谱
  const graph = getGraph(graphArray)
  console.log('graph', graph)
  
  // 返回图谱
  return graph
}

function getGraphArray(entryModule) {
  const graphArray = [entryModule]
  for(let i = 0; i < graphArray.length; i++){
      const item = graphArray[i];
      const {dependencies} = item;//拿到文件所依赖的模块集合(键值对存储)
      for(let j in dependencies){
          graphArray.push(stepOne(dependencies[j]))//敲黑板！关键代码，目的是将入口模块及其所有相关的模块放入数组
      }
  }
  return graphArray
}

function getGraph(graphArray) {
  const graph = {}
  graphArray.forEach(item => {
      graph[item.filename] = {
          dependencies: item.dependencies,
          code: item.code
      }
  })
  return graph
}
stepTwo('./src/index.js')
// 可以测试下：console.log(stepTwo('./src/index.js'))

function stepThree(entry){
  // //要先把对象转换为字符串，不然在下面的模板字符串中会默认调取对象的toString方法，参数变成[Object object],显然不行
  const graph = JSON.stringify(stepTwo(entry))
  
  return `
      (function(graph) {
          //require函数的本质是执行一个模块的代码，然后将相应变量挂载到exports对象上
          function require(module) {
              //localRequire的本质是拿到依赖包的exports变量
              function localRequire(relativePath) {
                  return require(graph[module].dependencies[relativePath]);
              }
              var exports = {};
              (function(require, exports, code) {
                  eval(code);
              })(localRequire, exports, graph[module].code);
              return exports;//函数返回指向局部变量，形成闭包，exports变量在函数执行后不会被摧毁
          }
          require('${entry}')
      })(${graph})`
}

// 可以测试下：console.log(stepThree('./src/index.js'))
console.log('three =>', stepThree('./src/index.js'))